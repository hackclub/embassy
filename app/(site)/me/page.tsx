import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/org";
import {
  isHackatimeConfigured,
  getHackatimeHours,
} from "@/lib/hackatime";
import PageHeader from "@/app/components/PageHeader";
import Section from "@/app/components/Section";

type BannerVariant = "success" | "warning" | "error";

const BANNER_MESSAGES: Record<string, { title: string; text: string; variant: BannerVariant }> = {
  linked: {
    title: "Hackatime linked",
    text: "Your Hackatime account is now connected. Your tracked coding time can be spent as credits in the shop.",
    variant: "success",
  },
  unlinked: {
    title: "Hackatime unlinked",
    text: "Your Hackatime account has been disconnected.",
    variant: "success",
  },
  denied: {
    title: "Hackatime not linked",
    text: "You declined the Hackatime connection request. You can try again at any time.",
    variant: "warning",
  },
  unconfigured: {
    title: "Hackatime not linked",
    text: "Hackatime linking is not available right now. Try again later.",
    variant: "warning",
  },
  token_error: {
    title: "Hackatime link failed",
    text: "There was a problem getting an access token from Hackatime. Please try again.",
    variant: "error",
  },
  state_mismatch: {
    title: "Hackatime link failed",
    text: "The connection could not be verified. Please start again.",
    variant: "error",
  },
};

function StatusCell({
  done,
  label,
}: {
  done: boolean;
  label: string;
}) {
  return (
    <span className={`govuk-task-list__status ${done ? "govuk-task-list__status--completed" : "govuk-task-list__status--todo"}`}>
      {label}
    </span>
  );
}

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ hackatime?: string }>;
}) {
  const user = await getCurrentUserWithRole();
  if (!user) return null;

  const { hackatime } = await searchParams;
  const banner = hackatime ? BANNER_MESSAGES[hackatime] : undefined;

  const configured = isHackatimeConfigured();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { hackatimeUid: true, creditsSpent: true },
  });
  const linked = Boolean(dbUser?.hackatimeUid);

  const [projectCount, journalCount, passportCount, recentProjects, recentJournal] =
    await Promise.all([
      prisma.project.count({ where: { userId: user.id } }),
      prisma.journalEntry.count({ where: { userId: user.id } }),
      prisma.passportOrder.count({ where: { recipientUserId: user.id } }),
      prisma.project.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.journalEntry.findMany({
        where: { userId: user.id },
        orderBy: { entryDate: "desc" },
        take: 3,
      }),
    ]);

  let credits: number | null = null;
  let hoursError = false;
  if (configured && linked && dbUser) {
    const hours = await getHackatimeHours(user.id);
    if (hours === null) {
      hoursError = true;
    } else {
      credits = Math.max(0, Math.floor(hours) - (dbUser.creditsSpent ?? 0));
    }
  }

  return (
    <>
      <PageHeader title="Your whoami" description={user.email ?? undefined} />

      <Section title="Credits" divider={true}>
        {configured ? (
          linked ? (
            <div className="govuk-inset">
              <p className="text-2xl font-bold">
                {hoursError
                  ? "Could not fetch hours right now"
                  : `Credits: ${credits ?? 0}`}
              </p>
              {!hoursError && (
                <p className="mt-1 text-govuk-grey-4">
                  1 credit = 1 hour of tracked coding time
                </p>
              )}
              <form action="/api/hackatime/unlink" method="post" className="mt-3">
                <button type="submit" className="govuk-button govuk-button--secondary govuk-button--small">
                  Unlink Hackatime
                </button>
              </form>
            </div>
          ) : (
            <div className="govuk-inset">
              <a href="/api/hackatime/authorize" className="govuk-button">
                Link Hackatime
              </a>
              <p className="mt-2 text-govuk-grey-4">
                Optional — connects your tracked coding time so you can spend credits in the shop.
              </p>
            </div>
          )
        ) : (
          <div className="govuk-inset">
            <span className="govuk-tag govuk-tag--grey">Hackatime linking not configured</span>
            <p className="mt-2 text-govuk-grey-4">
              Credit earning is unavailable on this deployment.
            </p>
          </div>
        )}
      </Section>

      {banner && (
        <div className={`govuk-notification-banner govuk-notification-banner--${banner.variant}`} role="alert">
          <p className="font-bold">{banner.title}</p>
          <p>{banner.text}</p>
        </div>
      )}

      <Section title="Your tasks" divider={true}>
        <ul className="govuk-task-list">
          <li className="govuk-task-list__item">
            <div className="govuk-task-list__name-and-hint">
              {linked ? (
                <span className="govuk-task-list__link">Link Hackatime (optional)</span>
              ) : (
                <a href="/api/hackatime/authorize" className="govuk-task-list__link">
                  Link Hackatime (optional)
                </a>
              )}
              <span className="govuk-task-list__hint">
                Connect your tracked coding time to earn credits.
              </span>
            </div>
            <StatusCell done={linked} label={linked ? "Done" : "To do"} />
          </li>
          <li className="govuk-task-list__item">
            <div className="govuk-task-list__name-and-hint">
              <Link href="/me/projects" className="govuk-task-list__link">
                Add a project
              </Link>
              <span className="govuk-task-list__hint">
                Show what you have been building.
              </span>
            </div>
            <StatusCell done={projectCount > 0} label={projectCount > 0 ? "Done" : "To do"} />
          </li>
          <li className="govuk-task-list__item">
            <div className="govuk-task-list__name-and-hint">
              <Link href="/me/journal" className="govuk-task-list__link">
                Write a journal entry
              </Link>
              <span className="govuk-task-list__hint">
                Keep a log of your work.
              </span>
            </div>
            <StatusCell done={journalCount > 0} label={journalCount > 0 ? "Done" : "To do"} />
          </li>
          <li className="govuk-task-list__item">
            <div className="govuk-task-list__name-and-hint">
              <Link href="/me/shop" className="govuk-task-list__link">
                Claim your passport
              </Link>
              <span className="govuk-task-list__hint">
                Spend credits in the shop.
              </span>
            </div>
            <StatusCell done={passportCount > 0} label={passportCount > 0 ? "Done" : "To do"} />
          </li>
        </ul>
      </Section>

      <Section title="Recent projects" divider={true}>
        {recentProjects.length === 0 ? (
          <p className="text-govuk-grey-4">No projects yet.</p>
        ) : (
          <ul className="space-y-2" role="list">
            {recentProjects.map((project) => (
              <li key={project.id}>
                <Link href="/me/projects" className="font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover">
                  {project.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent journal entries" divider={false}>
        {recentJournal.length === 0 ? (
          <p className="text-govuk-grey-4">No journal entries yet.</p>
        ) : (
          <ul className="space-y-2" role="list">
            {recentJournal.map((entry) => (
              <li key={entry.id}>
                <Link href="/me/journal" className="font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover">
                  {entry.title}
                </Link>
                <span className="ml-2 text-sm text-govuk-grey-4">
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(entry.entryDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
