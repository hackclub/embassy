"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/org";
import { getHackatimeHours } from "@/lib/hackatime";
import { MAX_PENDING_SUBMISSIONS_PER_USER } from "@/lib/constants";

// Only http(s) URLs — z.string().url() happily accepts javascript:/data:,
// which becomes stored XSS when an admin clicks the link in review.
const httpUrl = z
  .string()
  .trim()
  .url("Enter a valid URL (start with https://)")
  .refine(
    (v) => v.startsWith("https://") || v.startsWith("http://"),
    "Only http(s) links are allowed"
  );

const submitSchema = z.object({
  title: z.string().trim().min(2, "Add a title").max(80, "Title is too long"),
  description: z.string().trim().max(400, "Description is too long").optional(),
  url: httpUrl.optional().or(z.literal("")),
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

  const pendingCount = await prisma.submission.count({
    where: { userId: user.id, status: "SUBMITTED" },
  });
  if (pendingCount >= MAX_PENDING_SUBMISSIONS_PER_USER) {
    return {
      error: `You already have ${pendingCount} submissions awaiting review. Wait for a decision before submitting more.`,
    };
  }

  const membership = await prisma.orgMember.findFirst({
    where: { userId: user.id },
    orderBy: { id: "asc" },
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
  return { ok: true };
}
