"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/org";
import { getHackatimeHours } from "@/lib/hackatime";

const submitSchema = z.object({
  title: z.string().trim().min(2, "Add a title").max(80, "Title is too long"),
  description: z.string().trim().max(400, "Description is too long").optional(),
  url: z
    .string()
    .trim()
    .url("Enter a valid URL (start with https://)")
    .optional()
    .or(z.literal("")),
});

export type SubmitFormState = { error?: string; ok?: boolean } | undefined;

export async function submitProjectAction(
  _prev: SubmitFormState,
  formData: FormData
): Promise<SubmitFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/signin?callbackUrl=/submit");

  const parsed = submitSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    url: formData.get("url") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  const membership = await prisma.orgMember.findFirst({
    where: { userId: user.id },
  });

  // Snapshot the user's tracked hours so the reviewer can award credits
  // against a consistent number (live hours may change later).
  const hackatimeHours = await getHackatimeHours(user.id);

  await prisma.submission.create({
    data: {
      userId: user.id,
      orgId: membership?.orgId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      url: parsed.data.url || null,
      hackatimeHours,
    },
  });

  revalidatePath("/submit");
  revalidatePath("/vote");
  return { ok: true };
}

export type VoteFormState = void;

export async function voteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/signin?callbackUrl=/vote");

  const submissionId = formData.get("submissionId");
  if (typeof submissionId !== "string" || !submissionId) {
    return;
  }

  const existing = await prisma.vote.findUnique({
    where: { submissionId_userId: { submissionId, userId: user.id } },
  });
  if (existing) return;

  await prisma.vote.create({
    data: { submissionId, userId: user.id },
  });

  revalidatePath("/vote");
}
