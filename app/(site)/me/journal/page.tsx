import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/org";
import JournalEntryCard from "../JournalEntryCard";

export default async function JournalPage() {
  const user = await getCurrentUserWithRole();
  if (!user) return null;

  const [entries, projects] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { userId: user.id },
      orderBy: { entryDate: "desc" },
      include: { project: { select: { id: true, title: true } } },
    }),
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  const projectCount = projects.length;

  const entryData = entries.map((e) => ({
    id: e.id,
    title: e.title,
    content: e.content,
    entryDate: e.entryDate.toISOString().slice(0, 10),
    projectId: e.projectId,
    project: e.project ? { id: e.project.id, title: e.project.title } : null,
  }));

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
            No journals yet, tap a project card to write your first devlog.
          </p>
        </div>
      ) : (
        <ul className="space-y-6" role="list">
          {entryData.map((entry) => (
            <JournalEntryCard key={entry.id} entry={entry} projects={projects} />
          ))}
        </ul>
      )}
    </div>
  );
}