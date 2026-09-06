import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/org";
import PageHeader from "@/app/components/PageHeader";
import ProjectForm from "../ProjectForm";
import { deleteProjectAction } from "@/app/actions/me";

export default async function MeProjectsPage() {
  const user = await getCurrentUserWithRole();
  if (!user) return null;

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Your projects"
        description="Add the things you have been building."
      />

      <ProjectForm
        summary="New project"
        submitLabel="Add project"
        pendingLabel="Adding..."
        open={projects.length === 0}
      />

      {projects.length === 0 ? (
        <p className="text-govuk-grey-4">
          No projects yet. Use &ldquo;New project&rdquo; above to add your first one.
        </p>
      ) : (
        <ul className="space-y-0" role="list">
          {projects.map((project) => (
            <li
              key={project.id}
              className="border-t border-govuk-grey-2 py-5 last:border-b"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold">{project.title}</h2>
                <span className="text-sm text-govuk-grey-4">
                  Added{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(project.createdAt)}
                </span>
              </div>
              {project.description && (
                <p className="mt-1 whitespace-pre-wrap">{project.description}</p>
              )}
              {(project.githubUrl || project.demoUrl) && (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {project.githubUrl && (
                    <a
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
                    >
                      View code
                    </a>
                  )}
                  {project.demoUrl && (
                    <a
                      href={project.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
                    >
                      View demo
                    </a>
                  )}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-start gap-4">
                <ProjectForm
                  projectId={project.id}
                  defaultValues={{
                    title: project.title,
                    description: project.description ?? undefined,
                    githubUrl: project.githubUrl ?? undefined,
                    demoUrl: project.demoUrl ?? undefined,
                  }}
                  summary="Edit"
                  submitLabel="Save changes"
                  pendingLabel="Saving..."
                />
                <form action={deleteProjectAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <button type="submit" className="govuk-button govuk-button--secondary govuk-button--small">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm text-govuk-grey-4">
        Done here? <Link href="/me" className="text-govuk-blue underline underline-offset-4">Back to your whoami</Link>
      </p>
    </>
  );
}
