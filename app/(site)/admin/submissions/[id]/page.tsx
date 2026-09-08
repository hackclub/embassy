import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import ReviewForm from "./ReviewForm";
import { creditsForHours } from "@/lib/helpers";

export default async function AdminSubmissionReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUserWithRole();
  if (!user || !hasRole(user.role, "ADMIN")) redirect("/admin");

  const { id } = await params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      reviewer: { select: { name: true, email: true } },
      _count: { select: { votes: true } },
    },
  });
  if (!submission) return <p>Submission not found.</p>;

  const credits = submission.hackatimeHours
    ? creditsForHours(submission.hackatimeHours)
    : 0;

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/submissions"
        className="text-sm font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
      >
        ← Back to submissions
      </Link>
      <h1 className="mt-2 mb-1 text-3xl font-bold leading-tight tracking-tight">
        {submission.title}
      </h1>
      <p className="mb-4 text-govuk-grey-4">
        {submission.user?.name ?? submission.user?.email ?? "Unknown"} ·{" "}
        {new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(submission.createdAt)}
      </p>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <div className="game-box">
          <h2 className="mb-2 font-extrabold uppercase tracking-wide text-govuk-grey-4">
            Details
          </h2>
          {submission.description ? (
            <p className="text-sm leading-relaxed">{submission.description}</p>
          ) : (
            <p className="text-sm text-govuk-grey-4">No description.</p>
          )}
          {submission.url && (
            <a
              href={submission.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
            >
              {submission.url}
            </a>
          )}
          <p className="mt-4 text-sm text-govuk-grey-4">
            {submission._count.votes} vote{submission._count.votes === 1 ? "" : "s"}
          </p>
        </div>

        <div className="game-box">
          <h2 className="mb-2 font-extrabold uppercase tracking-wide text-govuk-grey-4">
            Credits
          </h2>
          <p className="text-sm leading-relaxed">
            {submission.hackatimeHours !== null ? (
              <>
                Snapshot: <strong>{submission.hackatimeHours} hours</strong> at submit
                → <strong>{credits} credits</strong>
              </>
            ) : (
              "No Hackatime hours were snapshotted for this submission."
            )}
          </p>
          {submission.creditsAwarded !== null && (
            <p className="mt-2 text-sm font-bold">
              Awarded: {submission.creditsAwarded} credits
            </p>
          )}
          {submission.reviewedAt && (
            <p className="mt-2 text-xs text-govuk-grey-4">
              Reviewed by {submission.reviewer?.name ?? "unknown"} ·{" "}
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(submission.reviewedAt)}
            </p>
          )}
        </div>
      </div>

      <ReviewForm
        submissionId={submission.id}
        alreadyReviewed={submission.status !== "SUBMITTED"}
        defaultHours={submission.hackatimeHours}
        defaultCredits={credits}
      />
    </div>
  );
}