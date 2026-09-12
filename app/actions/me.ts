"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateRecipientToken, getCurrentUserWithRole } from "@/lib/org";
import { buyItemInTx, lockUserPurchases, ShopError } from "@/lib/services/shop.service";

export type MeFormState = { error?: string; ok?: string } | undefined;

const SIGNIN_URL = "/api/auth/signin?callbackUrl=/me";

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// http(s) only — these URLs are rendered as clickable links (and the same
// pattern is reviewed by admins), so javascript:/data: must never be stored.
const httpUrl = z
  .string()
  .trim()
  .url("Enter a valid URL (start with https://)")
  .max(500, "URL is too long")
  .refine(
    (v) => v.startsWith("https://") || v.startsWith("http://"),
    "Only http(s) links are allowed"
  );

const projectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Enter a title (at least 2 characters)")
    .max(80, "Title is too long (maximum 80 characters)"),
  description: z
    .string()
    .trim()
    .max(1000, "Description is too long (maximum 1000 characters)")
    .optional(),
  githubUrl: httpUrl.optional(),
  demoUrl: httpUrl.optional(),
  hackatimeProject: z
    .string()
    .trim()
    .max(120, "Hackatime project name is too long")
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
    hackatimeProject: optionalString(formData.get("hackatimeProject")),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid project details.",
    } as const;
  }
  return {
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      githubUrl: parsed.data.githubUrl ?? null,
      demoUrl: parsed.data.demoUrl ?? null,
      hackatimeProject: parsed.data.hackatimeProject ?? null,
    },
  } as const;
}

export async function createProjectAction(
  _prev: MeFormState,
  formData: FormData,
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
  formData: FormData,
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
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid journal entry.",
    } as const;
  }
  const project = await prisma.project.findFirst({
    where: {
      id: parsed.data.projectId,
      userId: (await getCurrentUserWithRole())?.id,
    },
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
  formData: FormData,
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
  formData: FormData,
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
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid journal entry.",
    };
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

// Legacy identifier kept on purpose: the org slug is a unique DB key and
// existing passport orders reference the row created under "whoami-shop".
const SHOP_ORG_SLUG = "whoami-shop";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function ensureShopOrg(
  tx: Tx,
): Promise<{ orgId: string; yswsId: string }> {
  const org = await tx.org.upsert({
    where: { slug: SHOP_ORG_SLUG },
    create: { name: "Embassy shop", slug: SHOP_ORG_SLUG },
    update: {},
  });
  const ysws = await tx.ySWS.upsert({
    where: { slug: SHOP_ORG_SLUG },
    create: {
      name: "Embassy shop",
      slug: SHOP_ORG_SLUG,
      isActive: true,
      orgId: org.id,
    },
    update: { isActive: true },
  });
  return { orgId: org.id, yswsId: ysws.id };
}

const PASSPORT_CATEGORY = "passport";

export async function buyShopItemAction(
  _prev: ShopFormState,
  formData: FormData,
): Promise<ShopFormState> {
  const rawItemId = formData.get("itemId");
  if (typeof rawItemId !== "string" || !rawItemId) {
    return { error: "Missing item." };
  }
  const rawQuantity = formData.get("quantity");
  const quantity =
    typeof rawQuantity === "string" && /^\d+$/.test(rawQuantity)
      ? Number(rawQuantity)
      : 1;

  const user = await getCurrentUserWithRole();
  if (!user) redirect("/api/auth/signin?callbackUrl=/me/shop");

  const item = await prisma.shopItem.findUnique({
    where: { id: rawItemId },
  });
  if (!item || !item.isActive) {
    return { error: "That item isn't available right now." };
  }

  const isPassport = item.category === PASSPORT_CATEGORY;

  if (isPassport && quantity !== 1) {
    return { error: "You can only buy one passport at a time." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let passport: {
        orderId: string;
        recipientToken: string;
      } | null = null;

      if (isPassport) {
        // Lock first so the "one passport on the way" check can't be raced.
        await lockUserPurchases(tx, user.id);
        const activeOrderCount = await tx.passportOrder.count({
          where: {
            recipientUserId: user.id,
            currentState: { notIn: ["DELIVERED", "CANCELLED", "ERROR"] },
          },
        });
        if (activeOrderCount > 0) {
          throw new ShopError(
            "passport_in_flight",
            "You already have a passport on the way.",
          );
        }

        const { orgId, yswsId } = await ensureShopOrg(tx);

        const recipientToken = generateRecipientToken();
        const order = await tx.passportOrder.create({
          data: {
            orgId,
            yswsId,
            totalQuantity: 1,
            currentState: "RECIPIENT_DETAILS_RECEIVED",
            status: "PENDING",
            createdFrom: "shop",
            createdByUserId: user.id,
            recipientUserId: user.id,
            recipientName: user.name ?? user.email ?? "Embassy user",
            recipientEmail: user.email ?? "",
            recipientToken,
            recipients: {
              create: {
                email: user.email ?? "",
                name: user.name ?? "",
                userId: user.id,
              },
            },
            note: `Purchased from the Embassy shop for ${item.price} credits.`,
          },
          select: { id: true },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            eventType: "ORDER_CREATED",
            status: "PENDING",
            newState: "RECIPIENT_DETAILS_RECEIVED",
            actor: user.id,
            actorType: "RECIPIENT",
            description: `${item.name} purchased from the Embassy shop`,
          },
        });
        passport = { orderId: order.id, recipientToken };
      }

      const shop = await buyItemInTx(
        tx,
        user.id,
        item.id,
        quantity,
        `Bought ${quantity} × ${item.name}`,
      );

      return {
        passport,
        shopOrderId: shop.orderId,
      };
    });

    revalidatePath("/me/shop");
    revalidatePath("/me");

    const total = item.price * quantity;
    return result.passport
      ? {
          ok: `${item.name} ordered — you spent ${total} credits.`,
          trackUrl: `/track/${result.passport.recipientToken}`,
        }
      : { ok: `${item.name} purchased — you spent ${total} credits.` };
  } catch (err) {
    if (err instanceof ShopError) return { error: err.message };
    if ((err as { code?: string } | null)?.code === "INSUFFICIENT_CREDITS") {
      return { error: "You don't have enough credits for this." };
    }
    return { error: "Something went wrong. Try again." };
  }
}
