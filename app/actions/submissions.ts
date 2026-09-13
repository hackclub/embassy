"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/org";
import { getProjectHackatimeHours } from "@/lib/hackatime";
import { YSWS_START_DATE } from "@/lib/constants";

const submitSchema = z.object({
  projectId: z.string().min(1, "Choose a project to submit."),
  noteForReviewer: z
    .string()
    .trim()
    .max(2000, "Note to reviewer is too long (maximum 2000 characters)")
    .optional(),
});

export type SubmitFormState = { error?: string; ok?: string } | undefined;

const SIGNIN_URL = "/api/auth/signin?callbackUrl=/me/projects";

export async function submitProjectAction(
  _prev: SubmitFormState,
  formData: FormData,
): Promise<SubmitFormState> {
  const user = await getCurrentUser();
  if (!user) redirect(SIGNIN_URL);

  const parsed = submitSchema.safeParse({
    projectId: formData.get("projectId"),
    noteForReviewer: (formData.get("noteForReviewer") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, userId: user.id },
    select: {
      id: true,
      title: true,
      description: true,
      githubUrl: true,
      demoUrl: true,
      hackatimeProject: true,
    },
  });
  if (!project) return { error: "Project not found." };

  const missing = [
    project.description ? null : "a description",
    project.githubUrl ? null : "a code (GitHub) URL",
    project.demoUrl ? null : "a demo URL",
    project.hackatimeProject ? null : "the Hackatime project link",
  ].filter(Boolean);
  if (missing.length > 0) {
    return {
      error: `Add ${missing.join(", ")} before submitting.`,
    };
  }

  const existing = await prisma.submission.findFirst({
    where: { projectId: project.id, status: { not: "REJECTED" } },
    select: { status: true },
  });
  if (existing) {
    return {
      error:
        existing.status === "ACCEPTED"
          ? "This project was already accepted."
          : "This project is already under review.",
    };
  }

  const membership = await prisma.orgMember.findFirst({
    where: { userId: user.id },
  });

  const hackatimeHours = await getProjectHackatimeHours(
    user.id,
    project.hackatimeProject ?? "",
    YSWS_START_DATE,
  );

  await prisma.submission.create({
    data: {
      userId: user.id,
      orgId: membership?.orgId ?? null,
      projectId: project.id,
      title: project.title,
      description: project.description,
      url: project.githubUrl ?? project.demoUrl,
      noteForReviewer: parsed.data.noteForReviewer,
      hackatimeHours,
    },
  });

  revalidatePath("/me");
  revalidatePath("/me/projects");
  revalidatePath("/me/leaderboard");
  return { ok: "Submitted. Your project is now in the gallery." };
}

export async function rescindSubmissionAction(
  projectId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const submission = await prisma.submission.findFirst({
    where: { projectId, userId: user.id, status: "SUBMITTED" },
    select: { id: true },
  });
  if (!submission) return;

  await prisma.submission.delete({ where: { id: submission.id } });

  revalidatePath("/me");
  revalidatePath("/me/projects");
  revalidatePath("/me/leaderboard");
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
