"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateApiKeyWithExpiry, getCurrentUser, getCurrentUserWithRole, hasRole } from "@/lib/org";
import { verifyYSWSAccess } from "@/lib/ysws-context";
import { auditLog } from "@/lib/audit";
import { deliverOrderEmail } from "@/lib/services/email.service";

const createOrderSchema = z.object({
  recipientEmail: z.string().email("Enter a valid email"),
  recipientName: z.string().trim().min(2, "Enter the recipient's name").max(80, "Name is too long"),
  note: z.string().trim().max(300, "Note is too long").optional(),
  yswsId: z.string().nullable().optional(),
});

export type OrderFormState = { error?: string; ok?: boolean } | undefined;

export async function createOrderAction(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/signin?callbackUrl=/dashboard");

  const membership = await prisma.orgMember.findFirst({
    where: { userId: user.id },
    orderBy: { id: "asc" },
  });
  if (!membership) return { error: "You are not an organizer for any org." };

  const parsed = createOrderSchema.safeParse({
    recipientEmail: formData.get("recipientEmail") || undefined,
    recipientName: formData.get("recipientName"),
    note: formData.get("note") || undefined,
    yswsId: formData.get("yswsId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order." };
  }

  // Resolve the YSWS the order belongs to. When one is supplied it must be
  // one the caller can actually access, and the order's org is taken from
  // that YSWS — never from an arbitrary membership row (which could mix
  // org A with a YSWS from org B).
  let finalYswsId: string | undefined;
  let orgId = membership.orgId;

  if (parsed.data.yswsId) {
    const access = await verifyYSWSAccess(user.id, parsed.data.yswsId);
    if (!access) {
      return { error: "You do not have access to this YSWS." };
    }
    finalYswsId = access.yswsId;
    orgId = access.orgId;
  } else {
    const ysws = await prisma.ySWS.findFirst({
      where: { orgId: membership.orgId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!ysws) {
      return { error: "No YSWS found for this organization" };
    }
    finalYswsId = ysws.id;
  }

  const email = parsed.data.recipientEmail.toLowerCase().trim();
  const linkedUser = await prisma.user.findUnique({ where: { email } });

  const recipientToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  const order = await prisma.passportOrder.create({
    data: {
      orgId,
      yswsId: finalYswsId,
      totalQuantity: 1,
      currentState: "AWAITING_RECIPIENT_DETAILS",
      status: "PENDING",
      note: parsed.data.note ?? null,
      createdFrom: "dashboard",
      recipientName: parsed.data.recipientName,
      recipientEmail: email,
      recipientToken,
      createdByUserId: linkedUser?.id ?? null,
      recipients: {
        create: {
          email,
          name: parsed.data.recipientName,
          userId: linkedUser?.id ?? null,
        },
      },
    },
  });

  await deliverOrderEmail(order.id, "created");

  revalidatePath("/dashboard");
  return { ok: true };
}

export type ApiKeyFormState = { error?: string; ok?: string } | undefined;

export async function regenerateApiKeyAction(
  _prev: ApiKeyFormState,
  formData: FormData
): Promise<ApiKeyFormState> {
  const user = await getCurrentUserWithRole();
  if (!user) redirect("/api/auth/signin?callbackUrl=/dashboard");
  if (!hasRole(user.role, "ORGANIZER")) {
    return { error: "Only organizers can manage API keys." };
  }

  const orgId = formData.get("orgId");
  const yswsId = formData.get("yswsId");
  
  if (typeof orgId !== "string" || !orgId) {
    return { error: "Missing org." };
  }

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: user.id } },
  });
  if (!membership) return { error: "You are not a member of this org." };

  const yswsIdStr = typeof yswsId === "string" ? yswsId : null;
  if (!yswsIdStr) {
    return { error: "Missing YSWS." };
  }
  
  const access = await verifyYSWSAccess(user.id, yswsIdStr);
  if (!access) return { error: "You are not authorized for this YSWS." };

  const apiKeyData = await generateApiKeyWithExpiry();

  const ysws = await prisma.ySWS.findUnique({
    where: { id: yswsIdStr },
  });
  if (!ysws) return { error: "YSWS not found." };

  await prisma.ySWS.update({
    where: { id: ysws.id },
    data: { 
      apiKeyHash: apiKeyData.hash,
      apiKeyPrefix: apiKeyData.prefix,
      apiKeyDisplay: apiKeyData.display,
      apiKeyExpiresAt: apiKeyData.expiresAt,
      apiKeyScopes: apiKeyData.scopes,
    },
  });

  revalidatePath("/dashboard");
  return { ok: apiKeyData.key };
}

export type IssuePassportState = { error?: string; ok?: string } | undefined;

const issuePassportSchema = z.object({
  recipientName: z.string().trim().min(2, "Enter the recipient's name").max(80, "Name is too long"),
  recipientEmail: z.string().trim().email("Enter a valid email"),
  note: z.string().trim().max(300, "Note is too long").optional(),
});

export async function issuePassportAction(
  _prev: IssuePassportState,
  formData: FormData
): Promise<IssuePassportState> {
  const user = await getCurrentUserWithRole();
  if (!user) redirect("/api/auth/signin?callbackUrl=/dashboard");
  if (!hasRole(user.role, "ORGANIZER")) {
    return { error: "Only organizers can issue passports." };
  }

  const membership = await prisma.orgMember.findFirst({
    where: { userId: user.id },
    orderBy: { id: "asc" },
  });
  if (!membership) return { error: "You are not an organizer for any org." };

  const parsed = issuePassportSchema.safeParse({
    recipientName: formData.get("recipientName"),
    recipientEmail: formData.get("recipientEmail") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const email = parsed.data.recipientEmail.toLowerCase().trim();
  const linkedUser = await prisma.user.findUnique({ where: { email } });

  const ysws = await prisma.ySWS.findFirst({
    where: { orgId: membership.orgId },
  });
  if (!ysws) return { error: "No YSWS found for this org." };

  const recipientToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  const order = await prisma.passportOrder.create({
    data: {
      orgId: membership.orgId,
      yswsId: ysws.id,
      totalQuantity: 1,
      currentState: "AWAITING_RECIPIENT_DETAILS",
      status: "PENDING",
      note: parsed.data.note ?? null,
      createdByUserId: linkedUser?.id ?? null,
      createdFrom: "dashboard",
      recipientName: parsed.data.recipientName,
      recipientEmail: email,
      recipientToken,
      recipients: {
        create: {
          email,
          name: parsed.data.recipientName,
          userId: linkedUser?.id ?? null,
        },
      },
    },
  });

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      eventType: "ORDER_CREATED" as const,
      status: "PENDING" as const,
      newState: "AWAITING_RECIPIENT_DETAILS" as const,
      actor: user.id,
      actorType: "ORGANIZER" as const,
      description: `Passport order created for ${parsed.data.recipientName ?? email}`,
    },
  });

  await deliverOrderEmail(order.id, "created");

  revalidatePath("/dashboard");
  return { ok: "Passport order created. We will be in touch." };
}

export type SubmitRecipientDetailsState = { error?: string; ok?: string } | undefined;

const submitRecipientDetailsSchema = z.object({
  recipientName: z.string().trim().min(2, "Enter the recipient's name").max(80, "Name is too long"),
  recipientEmail: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  note: z.string().trim().max(300, "Note is too long").optional(),
});

export async function submitRecipientDetailsAction(
  _prev: SubmitRecipientDetailsState,
  formData: FormData
): Promise<SubmitRecipientDetailsState> {
  const user = await getCurrentUserWithRole();
  if (!user) return { error: "You must be signed in." };

  const orderId = formData.get("orderId") as string;
  if (!orderId) return { error: "Missing order ID." };

  const order = await prisma.passportOrder.findUnique({
    where: { id: orderId },
    include: { org: true, ysws: true },
  });
  if (!order) return { error: "Order not found." };

  const membership = await prisma.organizerYSWSMembership.findFirst({
    where: { userId: user.id, yswsId: order.yswsId },
  });
  if (!membership && !hasRole(user.role, "ADMIN")) {
    await auditLog({
      entityType: "PassportOrder",
      entityId: orderId,
      action: "UNAUTHORIZED_ACCESS_ATTEMPT",
      actor: user.id,
      actorType: "ORGANIZER",
      description: `Unauthorized attempt to submit recipient details for order ${orderId}`,
    });
    return { error: "You do not have access to this order." };
  }

  const parsed = submitRecipientDetailsSchema.safeParse({
    recipientName: formData.get("recipientName"),
    recipientEmail: formData.get("recipientEmail") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const email = parsed.data.recipientEmail?.toLowerCase().trim() || order.recipientEmail;
  const name = parsed.data.recipientName || order.recipientName;

  await prisma.passportOrder.update({
    where: { id: orderId },
    data: {
      recipientName: name,
      recipientEmail: email,
      currentState: "RECIPIENT_DETAILS_RECEIVED" as const,
      status: email ? "CONFIRMED" : "PENDING",
    },
  });

  await prisma.orderEvent.create({
    data: {
      orderId: orderId,
      eventType: "RECIPIENT_DETAILS_SUBMITTED" as const,
      status: order.status,
      previousState: "AWAITING_RECIPIENT_DETAILS" as const,
      newState: "RECIPIENT_DETAILS_RECEIVED" as const,
      actor: user.id,
      actorType: "ORGANIZER" as const,
      description: `Recipient details submitted for order ${orderId}`,
    },
  });

  if (email) {
    await deliverOrderEmail(orderId, "details");
  }

  revalidatePath("/dashboard");
  return { ok: "Recipient details received. Passport is now being prepared." };
}

export type RegenerateTrackingTokenState = { error?: string; ok?: string } | undefined;

export async function regenerateTrackingTokenAction(
  _prev: RegenerateTrackingTokenState,
  formData: FormData
): Promise<RegenerateTrackingTokenState> {
  const user = await getCurrentUserWithRole();
  if (!user) return { error: "You must be signed in." };

  const orderId = formData.get("orderId") as string;
  if (!orderId) return { error: "Missing order ID." };

  const order = await prisma.passportOrder.findUnique({
    where: { id: orderId },
    include: { org: true, ysws: true },
  });
  if (!order) return { error: "Order not found." };

  const membership = await prisma.organizerYSWSMembership.findFirst({
    where: { userId: user.id, yswsId: order.yswsId },
  });
  if (!membership && !hasRole(user.role, "ADMIN")) {
    await auditLog({
      entityType: "PassportOrder",
      entityId: orderId,
      action: "UNAUTHORIZED_ACCESS_ATTEMPT",
      actor: user.id,
      actorType: "ORGANIZER",
      description: `Unauthorized attempt to regenerate tracking token for order ${orderId}`,
    });
    return { error: "You do not have access to this order." };
  }

  const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  await prisma.passportOrder.update({
    where: { id: orderId },
    data: { recipientToken: newToken },
  });

  revalidatePath("/dashboard");
  return { ok: `Tracking token regenerated: ${newToken}` };
}