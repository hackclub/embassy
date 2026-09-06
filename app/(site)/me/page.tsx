import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/org";
import { isHackatimeConfigured, getHackatimeHours } from "@/lib/hackatime";
import { availableCredits } from "@/lib/credits";
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
            ? "border-[#00a85d] bg-[#00D875] text-white"
            : "border-govuk-grey-2 bg-white text-transparent"
        }`}
      >
        ✓
      </span>
      <span className={`text-sm leading-snug ${done ? "text-govuk-grey-4 line-through" : "font-semibold"}`}>
        {children}
      </span>
    </span>
  );

  return (
    <li className="py-1.5">
      {href && !done ? (
        <Link href={href} className="block rounded-xl px-1 py-1 hover:bg-white">
          {label}
        </Link>
      ) : (
        <div className="px-1 py-1">{label}</div>
      )}
      {hint && !done && <p className="ml-9 text-xs text-govuk-grey-4">{hint}</p>}
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
    select: { hackatimeUid: true, creditsSpent: true, name: true },
  });
  const linked = Boolean(dbUser?.hackatimeUid);

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      journalEntries: { orderBy: { entryDate: "desc" }, select: { id: true, title: true, content: true, entryDate: true } },
    },
  });

  let credits: number | null = null;
  if (configured && linked) {
    const hours = await getHackatimeHours(user.id);
    credits = availableCredits(hours, dbUser?.creditsSpent ?? 0);
  }

  const projectCount = projects.length;
  const hasPassport = await prisma.passportOrder.count({
    where: { recipientUserId: user.id },
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

  const tasksDone = {
    hackatime: linked,
    project: projectCount > 0,
    passport: hasPassport > 0,
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
        {credits !== null && (
          <span
            className="game-box inline-flex items-center gap-2 !rounded-full !py-2 font-bold"
            aria-label={`${credits} credits`}
          >
            <span aria-hidden="true" className="text-lg text-[#00a85d]">
              ●
            </span>
            {credits} credits
          </span>
        )}
        {linked && (
          <form action="/api/hackatime/unlink" method="post">
            <button
              type="submit"
              className="text-sm font-semibold text-govuk-grey-4 underline underline-offset-4 hover:text-govuk-black"
            >
              Unlink Hackatime
            </button>
          </form>
        )}
      </div>

      {hackatime === "linked" && (
        <div className="govuk-notification-banner govuk-notification-banner--success mb-6" role="alert">
          <p className="font-bold">Hackatime linked</p>
          <p>Your credits are ready to spend in the shop.</p>
        </div>
      )}
      {hackatime === "unlinked" && (
        <div className="govuk-notification-banner govuk-notification-banner--success mb-6" role="alert">
          <p className="font-bold">Hackatime unlinked</p>
          <p>Your Hackatime account has been disconnected.</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <section aria-label="Your projects">
          {projectCount === 0 ? (
            <div className="game-box flex flex-col items-center gap-4 py-12 text-center">
              <p className="max-w-sm text-govuk-grey-4">
                Projects are where your work lives — add one, then keep a journal
                on it as you build.
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

        <aside aria-label="Getting started" className="self-start lg:sticky lg:top-20">
          <div className="game-box">
            <h2 className="mb-2 font-extrabold uppercase tracking-wide text-govuk-grey-4">
              Getting started
            </h2>
            <ul className="divide-y-2 divide-dashed divide-govuk-grey-2" role="list">
              <TaskRow
                done={tasksDone.hackatime}
                href={linked ? undefined : "/api/hackatime/authorize"}
                hint={linked ? undefined : configured ? "Optional — unlocks the shop." : undefined}
              >
                <a href={linked ? undefined : "/api/hackatime/authorize"} className={linked ? undefined : "text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"}>
                  Link Hackatime (optional)
                </a>
              </TaskRow>
              <TaskRow done={tasksDone.project} hint={tasksDone.project ? undefined : "Use the green button."}>
                Add a project
              </TaskRow>
              <TaskRow done={projectCards.some((p) => p.journalEntries.length > 0)} href={tasksDone.project ? "/me/projects" : undefined} hint={projectCards.some((p) => p.journalEntries.length > 0) ? undefined : "Tap a project card to journal."}>
                Write a journal entry
              </TaskRow>
              <TaskRow
                done={tasksDone.passport}
                href="/me/shop"
                hint={tasksDone.passport ? undefined : "Spend credits in the shop."}
              >
                Claim your passport
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
    </>
  );
}
