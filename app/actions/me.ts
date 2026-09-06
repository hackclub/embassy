"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateRecipientToken, getCurrentUserWithRole } from "@/lib/org";
import { getHackatimeHours } from "@/lib/hackatime";
import { PASSPORT_PRICE_CREDITS, availableCredits } from "@/lib/credits";

export type MeFormState = { error?: string; ok?: string } | undefined;

const SIGNIN_URL = "/api/auth/signin?callbackUrl=/me";

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const projectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Enter a title (at least 2 characters)")
    .max(80, "Title is too long (maximum 80 characters)"),
  description: z.string().trim().max(1000, "Description is too long (maximum 1000 characters)").optional(),
  githubUrl: z
    .string()
    .trim()
    .regex(
      /^https:\/\/(github\.com|gitlab\.com)\//,
      "Code URL must start with https://github.com/ or https://gitlab.com/"
    )
    .optional(),
  demoUrl: z
    .string()
    .trim()
    .regex(/^https:\/\//, "Demo URL must start with https://")
    .max(500, "Demo URL is too long")
    .optional(),
});

const journalSchema = z.object({
  projectId: z.string().min(1, "Choose a project"),
  title: z
    .string()
    .trim()
    .min(2, "Enter a title (at least 2 characters)")
    .max(120, "Title is too long (maximum 120 characters)"),
  content: z
    .string()
    .trim()
    .min(10, "Write at least 10 characters")
    .max(5000, "Entry is too long (maximum 5000 characters)"),
});

async function createProjectData(formData: FormData) {
  const parsed = projectSchema.safeParse({
    title: formData.get("title"),
    description: optionalString(formData.get("description")),
    githubUrl: optionalString(formData.get("githubUrl")),
    demoUrl: optionalString(formData.get("demoUrl")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid project details." } as const;
  }
  return {
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      githubUrl: parsed.data.githubUrl ?? null,
      demoUrl: parsed.data.demoUrl ?? null,
    },
  } as const;
}

export async function createProjectAction(
  _prev: MeFormState,
  formData: FormData
): Promise<MeFormState> {
  const user = await getCurrentUserWithRole();
  if (!user) redirect(SIGNIN_URL);

  const parsed = await createProjectData(formData);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.project.create({
    data: { userId: user.id, ...parsed.data },
  });

  revalidatePath("/me/projects");
  revalidatePath("/me");
  return { ok: "Project added." };
}

export async function updateProjectAction(
  _prev: MeFormState,
  formData: FormData
): Promise<MeFormState> {
  const user = await getCurrentUserWithRole();
  if (!user) redirect(SIGNIN_URL);

  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Missing project." };

  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!existing) return { error: "Project not found." };

  const parsed = await createProjectData(formData);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.project.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  revalidatePath("/me/projects");
  revalidatePath("/me");
  return { ok: "Project updated." };
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const user = await getCurrentUserWithRole();
  if (!user) redirect(SIGNIN_URL);

  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;

  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.project.delete({ where: { id: existing.id } });

  revalidatePath("/me/projects");
  revalidatePath("/me");
}

async function createJournalData(formData: FormData) {
  const parsed = journalSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid journal entry." } as const;
  }
  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, userId: (await getCurrentUserWithRole())?.id },
    select: { id: true },
  });
  if (!project) return { error: "Project not found." } as const;
  return {
    data: {
      projectId: project.id,
      title: parsed.data.title,
      content: parsed.data.content,
      entryDate: new Date(),
    },
  } as const;
}

export async function createJournalAction(
  _prev: MeFormState,
  formData: FormData
): Promise<MeFormState> {
  const user = await getCurrentUserWithRole();
  if (!user) redirect(SIGNIN_URL);

  const parsed = await createJournalData(formData);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.journalEntry.create({
    data: { userId: user.id, ...parsed.data },
  });

  revalidatePath("/me/journal");
  revalidatePath("/me");
  return { ok: "Journal entry added." };
}

export async function updateJournalAction(
  _prev: MeFormState,
  formData: FormData
): Promise<MeFormState> {
  const user = await getCurrentUserWithRole();
  if (!user) redirect(SIGNIN_URL);

  const journalId = String(formData.get("journalId") ?? "");
  if (!journalId) return { error: "Missing journal entry." };

  const existing = await prisma.journalEntry.findFirst({
    where: { id: journalId, userId: user.id },
    select: { id: true },
  });
  if (!existing) return { error: "Journal entry not found." };

  const parsed = journalSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid journal entry." };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) return { error: "Project not found." };

  await prisma.journalEntry.update({
    where: { id: existing.id },
    data: {
      projectId: project.id,
      title: parsed.data.title,
      content: parsed.data.content,
    },
  });

  revalidatePath("/me/journal");
  revalidatePath("/me");
  return { ok: "Journal entry updated." };
}

export async function deleteJournalAction(formData: FormData): Promise<void> {
  const user = await getCurrentUserWithRole();
  if (!user) redirect(SIGNIN_URL);

  const journalId = String(formData.get("journalId") ?? "");
  if (!journalId) return;

  const existing = await prisma.journalEntry.findFirst({
    where: { id: journalId, userId: user.id },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.journalEntry.delete({ where: { id: existing.id } });

  revalidatePath("/me/journal");
  revalidatePath("/me");
}

export type ShopFormState =
  | { error?: string; ok?: string; trackUrl?: string }
  | undefined;

async function ensureShopOrg(): Promise<{ orgId: string; yswsId: string }> {
  const org = await prisma.org.upsert({
    where: { slug: "whoami-shop" },
    create: { name: "whoami shop", slug: "whoami-shop" },
    update: {},
  });
  const ysws = await prisma.ySWS.upsert({
    where: { slug: "whoami-shop" },
    create: {
      name: "whoami shop",
      slug: "whoami-shop",
      isActive: true,
      orgId: org.id,
    },
    update: { isActive: true },
  });
  return { orgId: org.id, yswsId: ysws.id };
}

export async function buyPassportAction(
  _prev: ShopFormState,
  formData: FormData
): Promise<ShopFormState> {
  if (String(formData.get("intent") ?? "") !== "passport") {
    return { error: "Invalid submission." };
  }

  const user = await getCurrentUserWithRole();
  if (!user) redirect("/api/auth/signin?callbackUrl=/me/shop");

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { hackatimeUid: true, creditsSpent: true, name: true, email: true },
  });
  if (!account) return { error: "Account not found. Try signing in again." };

  if (!account.hackatimeUid) {
    return {
      error: "Link Hackatime first — you need credits to buy the passport.",
    };
  }

  const hours = await getHackatimeHours(user.id);
  if (hours === null) {
    return { error: "Could not fetch your credit balance. Try again in a minute." };
  }

  const credits = availableCredits(hours, account.creditsSpent);
  if (credits === null || credits < PASSPORT_PRICE_CREDITS) {
    return {
      error: `Not enough credits — you have ${credits ?? 0}, the passport costs ${PASSPORT_PRICE_CREDITS}.`,
    };
  }

  try {
    const activeOrderCount = await prisma.passportOrder.count({
      where: {
        recipientUserId: user.id,
        currentState: { notIn: ["DELIVERED", "CANCELLED", "ERROR"] },
      },
    });
    if (activeOrderCount > 0) {
      return { error: "You already have a passport on the way." };
    }

    const { orgId, yswsId } = await ensureShopOrg();
    const recipientToken = generateRecipientToken();

    const order = await prisma.passportOrder.create({
      data: {
        orgId,
        yswsId,
        totalQuantity: 1,
        currentState: "RECIPIENT_DETAILS_RECEIVED",
        status: "PENDING",
        createdFrom: "shop",
        createdByUserId: user.id,
        recipientUserId: user.id,
        recipientName: account.name ?? account.email ?? "whoami user",
        recipientEmail: account.email ?? "",
        recipientToken,
        recipients: {
          create: {
            email: account.email ?? "",
            name: account.name ?? "",
            userId: user.id,
          },
        },
        note: `Purchased from the whoami shop for ${PASSPORT_PRICE_CREDITS} credits.`,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { creditsSpent: { increment: PASSPORT_PRICE_CREDITS } },
    });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: "ORDER_CREATED",
        status: "PENDING",
        newState: "RECIPIENT_DETAILS_RECEIVED",
        actor: user.id,
        actorType: "RECIPIENT",
        description: "Passport purchased from the whoami shop",
      },
    });

    revalidatePath("/me/shop");
    revalidatePath("/me");
    return { ok: "Passport ordered!", trackUrl: `/track/${recipientToken}` };
  } catch {
    return { error: "Something went wrong. Try again." };
  }
}
