"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { addCredits } from "@/lib/services/credits.service";
import { creditsForHours } from "@/lib/helpers";

export type ReviewFormState = { error?: string; ok?: boolean } | undefined;

export async function reviewSubmissionAction(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const reviewer = await getCurrentUserWithRole();
  if (!reviewer) redirect("/api/auth/signin?callbackUrl=/admin/submissions");
  if (!hasRole(reviewer.role, "ADMIN")) {
    return { error: "You need admin access." };
  }

  const submissionId = String(formData.get("submissionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!submissionId || !["ACCEPTED", "REJECTED"].includes(decision)) {
    return { error: "Invalid review." };
  }

  const rawHours = formData.get("hoursOverride");
  const hoursOverride =
    typeof rawHours === "string" && rawHours.trim() !== ""
      ? Number(rawHours)
      : null;
  if (
    hoursOverride !== null &&
    (!Number.isFinite(hoursOverride) || hoursOverride < 0)
  ) {
    return { error: "Hours must be a positive number." };
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  });
  if (!submission) return { error: "Submission not found." };

  try {
    if (decision === "ACCEPTED") {
      if (submission.status === "ACCEPTED") {
        return { error: "This submission was already accepted." };
      }
      if (submission.creditsAwarded !== null) {
        return { error: "Credits were already awarded for this submission." };
      }

      const hours = hoursOverride ?? submission.hackatimeHours ?? 0;
      const credits = creditsForHours(hours);

      await prisma.$transaction(async (tx) => {
        await tx.submission.update({
          where: { id: submission.id },
          data: {
            status: "ACCEPTED",
            creditsAwarded: credits,
            reviewedById: reviewer.id,
            reviewedAt: new Date(),
          },
        });
        await addCredits(
          {
            userId: submission.userId,
            amount: credits,
            type: "EARNED",
            submissionId: submission.id,
            description: `Credits for accepted submission: ${submission.title}`,
          },
          tx,
        );
      });
    } else {
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: "REJECTED",
          reviewedById: reviewer.id,
          reviewedAt: new Date(),
        },
      });
    }
  } catch {
    return { error: "Couldn't save the review. Try again." };
  }

  revalidatePath("/admin/submissions");
  revalidatePath("/admin/submissions/" + submission.id);
  revalidatePath("/me");
  return { ok: true };
}
