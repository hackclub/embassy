"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateApiKey, generateApiKeyWithHash, getCurrentUserWithRole, hasRole, isSuperadminEmail } from "@/lib/org";
import { verifyYSWSAccess } from "@/lib/ysws-context";
import { adjustCredits } from "@/lib/services/credits.service";
import type { Role } from "../../generated/prisma/client";

const addOrganizerSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  orgName: z.string().trim().min(2, "Org name is too short").max(60, "Org name is too long"),
  orgSlug: z
    .string()
    .trim()
    .min(2, "Slug is too short")
    .max(40, "Slug is too long")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and dashes"),
  description: z.string().trim().max(300).optional(),
});

export type AdminFormState = { error?: string; ok?: string } | undefined;

export async function addOrganizerAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const actor = await getCurrentUserWithRole();
  if (!actor) redirect("/api/auth/signin?callbackUrl=/admin");
  if (!hasRole(actor.role, "ADMIN")) {
    return { error: "Admins and superadmins can register organizers." };
  }

  const parsed = addOrganizerSchema.safeParse({
    email: formData.get("email"),
    orgName: formData.get("orgName"),
    orgSlug: formData.get("orgSlug"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user) {
    return { error: "No account found with that email. Ask them to sign in once first." };
  }

  const slug = parsed.data.orgSlug;
  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.org.upsert({
        where: { slug },
        create: {
          name: parsed.data.orgName,
          slug,
          description: parsed.data.description ?? null,
        },
        update: {},
      });

      const apiKeyData = await generateApiKeyWithHash();

      await tx.ySWS.upsert({
        where: { slug: org.slug },
        create: {
          name: org.name,
          slug: org.slug,
          apiKeyHash: apiKeyData.hash,
          apiKeyDisplay: apiKeyData.key.slice(-4),
          isActive: true,
          orgId: org.id,
        },
        update: {},
      });

      await tx.orgMember.upsert({
        where: { orgId_userId: { orgId: org.id, userId: user.id } },
        create: { orgId: org.id, userId: user.id, role: "OWNER" },
        update: { role: "OWNER" },
      });
      // Only upgrade global role if user is currently PARTICIPANT
      // YSWS membership and global roles are separate dimensions
      // Don't downgrade superadmins (from env var) to organizer
      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { role: true, email: true },
      });
      const isSuperadmin = currentUser?.email ? isSuperadminEmail(currentUser.email) : false;
      const currentRole = currentUser?.role;
      // Only upgrade if user is PARTICIPANT and not a superadmin via env var
      if (currentRole === "PARTICIPANT" && !isSuperadmin) {
        await tx.user.update({
          where: { id: user.id },
          data: { role: "ORGANIZER" },
        });
      }
    });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { error: "That slug is already taken." };
    }
    return { error: "Something went wrong registering this organizer." };
  }

  revalidatePath("/admin");
  return {
    ok: `Registered ${parsed.data.email} as an organizer of ${parsed.data.orgName}.`,
  };
}

const setRoleSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["PARTICIPANT", "ORGANIZER", "ADMIN", "SUPERADMIN"]),
});

export async function setRoleAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const actor = await getCurrentUserWithRole();
  if (!actor) redirect("/api/auth/signin?callbackUrl=/admin");
  if (!hasRole(actor.role, "SUPERADMIN")) {
    return { error: "Only superadmins can change roles." };
  }

  const parsed = setRoleSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const target = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!target) {
    return { error: "No account found with that email." };
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role as Role },
  });

  revalidatePath("/admin");
  return { ok: `Set ${parsed.data.email} to ${parsed.data.role}.` };
}

const issuePassportSchema = z.object({
  orgId: z.string().min(1, "Choose an org"),
  recipientName: z.string().trim().min(2, "Enter the recipient's name").max(80, "Name is too long"),
  recipientEmail: z.string().trim().email("Enter a valid email"),
  note: z.string().trim().max(300, "Note is too long").optional(),
});

export async function issuePassportAdminAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const actor = await getCurrentUserWithRole();
  if (!actor) redirect("/api/auth/signin?callbackUrl=/admin");
  if (!hasRole(actor.role, "ADMIN")) {
    return { error: "Admins and superadmins can trigger passport orders." };
  }

  const parsed = issuePassportSchema.safeParse({
    orgId: formData.get("orgId"),
    recipientName: formData.get("recipientName"),
    recipientEmail: formData.get("recipientEmail"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const org = await prisma.org.findUnique({
    where: { id: parsed.data.orgId },
  });
  if (!org) return { error: "That org does not exist." };

  // Check actor has access to this org using unified context
  const access = await verifyYSWSAccess(actor.id, org.id);
  // Admin has broader access, but still verify
  if (!access && actor.role !== "SUPERADMIN") {
    return { error: "You do not have access to this org." };
  }

  const email = parsed.data.recipientEmail.toLowerCase().trim();
  const linkedUser = await prisma.user.findUnique({ where: { email } });

  // Get the YSWS for this org
  const ysws = await prisma.ySWS.findFirst({
    where: { orgId: org.id },
  });
  if (!ysws) return { error: "No YSWS found for this org." };

  const recipientToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  await prisma.passportOrder.create({
    data: {
      orgId: org.id,
      yswsId: ysws.id,
      totalQuantity: 1,
      currentState: "AWAITING_RECIPIENT_DETAILS",
      status: "PENDING",
      note: parsed.data.note ?? null,
      createdFrom: "admin",
      createdByUserId: linkedUser?.id ?? null,
      recipientName: parsed.data.recipientName.trim(),
      recipientEmail: email,
      recipientToken,
      // Create the recipient record (one order = one recipient)
      recipients: {
        create: {
          email,
          name: parsed.data.recipientName.trim(),
          userId: linkedUser?.id ?? null,
        },
      },
    },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return {
    ok: linkedUser
      ? `Order created for ${linkedUser.name ?? email}.`
      : `Order created for ${parsed.data.recipientName} (${email}).`,
  };
}

const adjustCreditsSchema = z.object({
  userId: z.string().min(1, "Missing user"),
  amount: z
    .string()
    .trim()
    .regex(/^-?\d+$/, "Enter a whole number (positive to add, negative to remove)")
    .transform(Number),
  description: z
    .string()
    .trim()
    .min(2, "Add a short note for the credit history")
    .max(200, "Note is too long"),
});

export async function adjustCreditsAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const actor = await getCurrentUserWithRole();
  if (!actor) redirect("/api/auth/signin?callbackUrl=/admin");
  if (!hasRole(actor.role, "ADMIN")) {
    return { error: "Admins and superadmins can adjust credits." };
  }

  const parsed = adjustCreditsSchema.safeParse({
    userId: formData.get("userId"),
    amount: formData.get("amount"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, name: true, email: true },
  });
  if (!target) return { error: "No account found with that id." };

  const { amount } = parsed.data;
  if (amount === 0) return { error: "Amount cannot be zero." };

  const sign = amount > 0 ? "+" : "";
  const note = `${actor.name ?? actor.email ?? "admin"}: ${parsed.data.description}`;

  try {
    await adjustCredits(target.id, amount, note);
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "INSUFFICIENT_CREDITS") {
      return { error: "That would take the balance below zero." };
    }
    return { error: "Something went wrong adjusting credits." };
  }

  revalidatePath(`/admin/users/${target.id}`);
  return {
    ok: `${sign}${amount} credits applied to ${target.name ?? target.email}.`,
  };
}