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
      project: {
        select: {
          aiDeclaration: true,
          githubUrl: true,
          demoUrl: true,
          hackatimeProject: true,
        },
      },
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

      <div className="mb-6 space-y-6">
        <div className="game-box">
          <h2 className="mb-2 font-extrabold uppercase tracking-wide text-govuk-grey-4">
            Details
          </h2>
          {submission.description ? (
            <p className="text-sm leading-relaxed">{submission.description}</p>
          ) : (
            <p className="text-sm text-govuk-grey-4">No description.</p>
          )}

          <div className="mt-3 space-y-1">
            {submission.project?.githubUrl ? (
              <a
                href={submission.project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
              >
                Code: {submission.project.githubUrl}
              </a>
            ) : (
              <p className="text-sm text-govuk-grey-4">No code URL.</p>
            )}
            {submission.project?.demoUrl ? (
              <a
                href={submission.project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
              >
                Demo: {submission.project.demoUrl}
              </a>
            ) : (
              <p className="text-sm text-govuk-grey-4">No demo URL.</p>
            )}
            {submission.project?.hackatimeProject && (
              <p className="text-sm font-semibold">
                Hackatime project: {submission.project.hackatimeProject}
              </p>
            )}
          </div>
          {submission.noteForReviewer && (
            <div className="mt-4 rounded-md border-l-4 border-[#ff902f] bg-[#fff7e6] px-3 py-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-govuk-grey-4">
                Note to reviewer
              </h3>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                {submission.noteForReviewer}
              </p>
            </div>
          )}
          {submission.project?.aiDeclaration && (
            <div className="mt-3 rounded-md border-l-4 border-govuk-blue bg-govuk-grey-1 px-3 py-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-govuk-grey-4">
                AI declaration
              </h3>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                {submission.project.aiDeclaration}
              </p>
            </div>
          )}
          {submission.reviewReason && (
            <div className="mt-4 rounded-md border-l-4 border-govuk-green bg-govuk-grey-1 px-3 py-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-govuk-grey-4">
                Review reason
              </h3>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                {submission.reviewReason}
              </p>
            </div>
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