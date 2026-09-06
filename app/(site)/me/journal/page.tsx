import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/org";
import JournalMarkdown from "../JournalMarkdown";

export default async function JournalPage() {
  const user = await getCurrentUserWithRole();
  if (!user) return null;

  const entries = await prisma.journalEntry.findMany({
    where: { userId: user.id },
    orderBy: { entryDate: "desc" },
    include: { project: { select: { id: true, title: true } } },
  });

  const projectCount = await prisma.project.count({ where: { userId: user.id } });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Your journal</h1>

      {projectCount === 0 ? (
        <div className="game-box text-center">
          <p className="mb-4 text-govuk-grey-4">
            Journals live on projects. Add a project first, then tap its card to
            write entries.
          </p>
          <Link href="/me/projects" className="govuk-button">
            Go to projects
          </Link>
        </div>
      ) : entries.length === 0 ? (
        <div className="game-box text-center">
          <p className="text-govuk-grey-4">
            No entries yet — tap a project card to write your first devlog.
          </p>
        </div>
      ) : (
        <ul className="space-y-6" role="list">
          {entries.map((entry) => (
            <li key={entry.id} className="game-box !p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold leading-tight">{entry.title}</h2>
                <span className="text-sm text-govuk-grey-4">
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(entry.entryDate)}
                </span>
              </div>
              {entry.project && (
                <Link
                  href="/me/projects"
                  className="govuk-tag govuk-tag--grey mb-3 inline-block text-xs"
                >
                  {entry.project.title}
                </Link>
              )}
              <JournalMarkdown content={entry.content} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
