import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import { creditsForHours } from "@/lib/helpers";

export default async function AdminSubmissionsPage() {
  const user = await getCurrentUserWithRole();
  if (!user || !hasRole(user.role, "ADMIN")) redirect("/admin");

  const submissions = await prisma.submission.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { votes: true } },
    },
  });

  const statusStyle: Record<string, string> = {
    SUBMITTED: "govuk-tag--blue",
    ACCEPTED: "govuk-tag--green",
    REJECTED: "govuk-tag--grey",
    DRAFT: "govuk-tag--grey",
  };

  return (
    <div>
      <h1 className="mb-1 text-3xl font-bold leading-tight tracking-tight">
        Submissions
      </h1>
      <p className="mb-6 text-govuk-grey-4">
        Review project submissions and award credits.
      </p>

      {submissions.length === 0 ? (
        <p className="text-govuk-grey-4">No submissions yet.</p>
      ) : (
        <ul className="space-y-0" role="list">
          {submissions.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-govuk-grey-2 py-4 last:border-b"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/submissions/${s.id}`}
                  className="font-semibold text-govuk-black underline underline-offset-4 hover:text-govuk-blue"
                >
                  {s.title}
                </Link>
                <p className="text-sm text-govuk-grey-4">
                  {s.user?.name ?? s.user?.email ?? "Unknown"} ·{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(s.createdAt)}
                </p>
                {s.hackatimeHours !== null && (
                  <p className="mt-1 text-sm font-semibold">
                    ~{s.hackatimeHours}h → {creditsForHours(s.hackatimeHours)} credits
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-govuk-grey-4">
                  {s._count.votes} vote{s._count.votes === 1 ? "" : "s"}
                </span>
                <span className={`govuk-tag ${statusStyle[s.status] ?? "govuk-tag--grey"}`}>
                  {s.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}