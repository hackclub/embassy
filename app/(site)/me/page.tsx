import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/org";
import { isHackatimeConfigured } from "@/lib/hackatime";
import { getTransactionHistory } from "@/lib/services/credits.service";
import ProjectCard from "./ProjectCard";
import NewProjectButton from "./NewProjectButton";
import type { ProjectCardData } from "./ProjectCard";

function TaskRow({
  done,
  href,
  children,
  hint,
}: {
  done: boolean;
  href?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const label = (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[3px] text-xs font-extrabold ${
          done
            ? "border-[#f59e0b] bg-[#f59e0b] text-white"
            : "border-govuk-grey-2 bg-white text-transparent"
        }`}
      >
        ✓
      </span>
      <span
        className={`text-sm leading-snug ${done ? "text-govuk-grey-4 line-through" : "font-semibold"}`}
      >
        {children}
      </span>
    </span>
  );

  return (
    <li className="py-1.5">
      {href && !done ? (
        <Link href={href} className="block rounded-sm px-1 py-1 hover:bg-white">
          {label}
        </Link>
      ) : (
        <div className="px-1 py-1">{label}</div>
      )}
      {hint && !done && (
        <p className="ml-9 text-xs text-govuk-grey-4">{hint}</p>
      )}
    </li>
  );
}

export default async function MeHome({
  searchParams,
}: {
  searchParams: Promise<{ hackatime?: string }>;
}) {
  const user = await getCurrentUserWithRole();
  if (!user) return null;

  const { hackatime } = await searchParams;

  const configured = isHackatimeConfigured();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { hackatimeUid: true, name: true },
  });
  const linked = Boolean(dbUser?.hackatimeUid);

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      journalEntries: {
        orderBy: { entryDate: "desc" },
        select: { id: true, title: true, content: true, entryDate: true },
      },
    },
  });

  const [submissions, transactions] = await Promise.all([
    prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        hackatimeHours: true,
        creditsAwarded: true,
        createdAt: true,
      },
    }),
    getTransactionHistory(user.id, 10),
  ]);

  const projectCount = projects.length;

  const recentEntries = projects
    .flatMap((p) =>
      p.journalEntries.map((e) => ({ ...e, projectTitle: p.title })),
    )
    .sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())
    .slice(0, 4);

  const projectCards: ProjectCardData[] = projects.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    githubUrl: p.githubUrl,
    demoUrl: p.demoUrl,
    hackatimeProject: p.hackatimeProject,
    journalEntries: p.journalEntries.map((e) => ({
      id: e.id,
      title: e.title,
      content: e.content,
      entryDate: e.entryDate.toISOString(),
    })),
  }));

  const tasksDone = {
    hackatime: linked,
    project: projectCount > 0,
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            {dbUser?.name ? `Hey ${dbUser.name.split(" ")[0]}` : "Your whoami"}
          </h1>
          <p className="mt-1 text-govuk-grey-4">{user.email}</p>
        </div>
      </div>

      {hackatime === "linked" && (
        <div
          className="govuk-notification-banner govuk-notification-banner--success mb-6"
          role="alert"
        >
          <p className="font-bold">Hackatime linked</p>
          <p>Your credits are ready to spend in the shop.</p>
        </div>
      )}
      {hackatime === "unlinked" && (
        <div
          className="govuk-notification-banner govuk-notification-banner--success mb-6"
          role="alert"
        >
          <p className="font-bold">Hackatime unlinked</p>
          <p>Your Hackatime account has been disconnected.</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <section aria-label="Your projects">
          {projectCount === 0 ? (
            <div className="game-box flex flex-col items-center gap-4 py-12 text-center">
              <p className="max-w-sm text-base font-semibold text-govuk-grey-4">
                Get started by adding a project!
              </p>
              <NewProjectButton />
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                {projectCards.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
              <div className="mt-6">
                <NewProjectButton />
              </div>
            </>
          )}
        </section>

        <aside aria-label="Getting started" className="self-start">
          <div className="rounded-xl border border-govuk-grey-2 bg-white p-5">
            <h2 className="mb-2 font-extrabold uppercase tracking-wide text-govuk-grey-4">
              Getting started
            </h2>
            <ul
              className="divide-y-2 divide-dashed divide-govuk-grey-2"
              role="list"
            >
              <TaskRow
                done={tasksDone.hackatime}
                href={linked ? undefined : "/api/hackatime/authorize"}
                hint={linked ? undefined : configured ? "" : undefined}
              >
                <span
                  className={
                    linked
                      ? undefined
                      : "text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
                  }
                >
                  Link Hackatime
                </span>
              </TaskRow>
              <TaskRow
                done={tasksDone.project}
                hint={tasksDone.project ? undefined : "Use the green button."}
              >
                Add a project
              </TaskRow>
              <TaskRow
                done={projectCards.some((p) => p.journalEntries.length > 0)}
                href={tasksDone.project ? "/me/projects" : undefined}
                hint={
                  projectCards.some((p) => p.journalEntries.length > 0)
                    ? undefined
                    : "Tap a project card to journal."
                }
              >
                Write a journal entry
              </TaskRow>
            </ul>
          </div>

          {!configured && (
            <p className="mt-3 text-xs text-govuk-grey-4">
              Hackatime linking is not available on this deployment.
            </p>
          )}
        </aside>
      </div>

      {recentEntries.length > 0 && (
        <section className="mt-10" aria-label="Recent journal entries">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold">Recent journal entries</h2>
            <Link
              href="/me/journal"
              className="text-sm font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
            >
              View all
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2" role="list">
            {recentEntries.map((entry) => (
              <li key={entry.id} className="project-card p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-govuk-grey-4">
                  {entry.projectTitle}
                </p>
                <h3 className="mt-1 font-bold leading-tight">{entry.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-govuk-grey-4">
                  {entry.content.replace(/[#*_>`~\[\]()]/g, "").slice(0, 160)}
                  {entry.content.length > 160 ? "…" : ""}
                </p>
                <p className="mt-3 text-xs text-govuk-grey-4">
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(entry.entryDate)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {submissions.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">Your submissions</h2>
          <ul className="space-y-0" role="list">
            {submissions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-govuk-grey-2 py-3 last:border-b"
              >
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-govuk-grey-4">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(s.createdAt)}
                    {s.creditsAwarded !== null &&
                      ` · earned ${s.creditsAwarded} credits`}
                  </p>
                </div>
                <span
                  className={`govuk-tag ${
                    s.status === "ACCEPTED"
                      ? "govuk-tag--green"
                      : s.status === "REJECTED"
                        ? "govuk-tag--grey"
                        : "govuk-tag--blue"
                  }`}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {transactions.length > 0 ? (
        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="game-box">
            <h2 className="mb-2 font-extrabold uppercase tracking-wide text-govuk-grey-4">
              Recent activity
            </h2>
            <ul
              className="divide-y-2 divide-dashed divide-govuk-grey-2"
              role="list"
            >
              {transactions.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {t.description ?? "Credits"}
                    </p>
                    <p className="text-xs text-govuk-grey-4">{t.type}</p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-extrabold ${
                      t.amount > 0 ? "text-[#00a85d]" : "text-hc-red"
                    }`}
                  >
                    {t.amount > 0 ? "+" : ""}
                    {t.amount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
