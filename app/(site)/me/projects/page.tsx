import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/org";
import ProjectCard from "../ProjectCard";
import NewProjectButton from "../NewProjectButton";
import type { ProjectCardData } from "../ProjectCard";

export default async function ProjectsPage() {
  const user = await getCurrentUserWithRole();
  if (!user) return null;

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      journalEntries: { orderBy: { entryDate: "desc" }, select: { id: true, title: true, content: true, entryDate: true } },
    },
  });

  const projectCards: ProjectCardData[] = projects.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    githubUrl: p.githubUrl,
    demoUrl: p.demoUrl,
    journalEntries: p.journalEntries.map((e) => ({
      id: e.id,
      title: e.title,
      content: e.content,
      entryDate: e.entryDate.toISOString(),
    })),
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Your projects</h1>

      {projectCards.length === 0 ? (
        <div className="game-box flex flex-col items-center gap-4 py-12 text-center">
          <p className="max-w-sm text-govuk-grey-4">
            No projects yet. Add one to start keeping a build journal.
          </p>
          <NewProjectButton />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {projectCards.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
