import Link from "next/link";
import { getCurrentUserWithRole } from "@/lib/org";
import {
  getLeaderboard,
  type LeaderboardBucket,
  type LeaderboardEntry,
} from "@/lib/services/leaderboard.service";

const MEDALS = ["🥇", "🥈", "🥉"];

function bucketLink(bucket: LeaderboardBucket): string {
  return bucket === "weekly" ? "/me/leaderboard?bucket=weekly" : "/me/leaderboard";
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return "<1m";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function RankCell({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center text-xl"
      >
        {MEDALS[rank - 1]}
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center text-sm font-extrabold text-govuk-grey-4">
      {rank}
    </span>
  );
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-full border-2 border-govuk-grey-2 bg-govuk-grey-1 object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-govuk-grey-2 bg-govuk-blue text-xs font-bold text-white"
    >
      {initials(name)}
    </span>
  );
}

function Row({
  entry,
  isYou,
}: {
  entry: LeaderboardEntry;
  isYou: boolean;
}) {
  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${
        isYou ? "border-l-4 border-[#f59e0b] bg-[#fff7e6]" : "border-l-4 border-transparent"
      }`}
    >
      <span className="w-9 shrink-0 text-center">
        <RankCell rank={entry.rank} />
      </span>
      <Avatar name={entry.name} image={entry.image} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-bold leading-tight">
          <span className="truncate">{entry.name}</span>
          {isYou && <span className="govuk-tag govuk-tag--grey">You</span>}
        </p>
        <p className="text-xs text-govuk-grey-4">
          {entry.projectCount} {entry.projectCount === 1 ? "project" : "projects"}
        </p>
      </div>
      <p className="shrink-0 text-sm font-extrabold tabular-nums text-govuk-black">
        {formatDuration(entry.seconds)}
      </p>
    </li>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string }>;
}) {
  const user = await getCurrentUserWithRole();
  if (!user) return null;

  const { bucket } = await searchParams;
  const activeBucket: LeaderboardBucket = bucket === "weekly" ? "weekly" : "all";

  const entries = await getLeaderboard(activeBucket);

  const buckets: { value: LeaderboardBucket; label: string }[] = [
    { value: "all", label: "All time" },
    { value: "weekly", label: "This week" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="mt-1 text-sm text-govuk-grey-4">
          Code time tracked on Hackatime for your accepted submissions.
        </p>
      </div>

      <div
        role="group"
        aria-label="Leaderboard time period"
        className="mb-6 inline-flex rounded-lg border-2 border-govuk-grey-2 bg-white p-1"
      >
        {buckets.map((b) => {
          const active = b.value === activeBucket;
          return (
            <Link
              key={b.value}
              href={bucketLink(b.value)}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold no-underline transition-colors ${
                active
                  ? "bg-govuk-blue text-white"
                  : "text-govuk-blue hover:bg-govuk-grey-1 hover:text-govuk-blue-hover"
              }`}
            >
              {b.label}
            </Link>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <div className="game-box text-center">
          <p className="mb-4 text-govuk-grey-4">
            No accepted submissions yet. Submit your project and link Hackatime
            to start climbing the board.
          </p>
          <Link
            href="/me/projects"
            className="govuk-button !bg-[#ff902f] !shadow-none"
          >
            Go to projects
          </Link>
        </div>
      ) : (
        <ol
          className="divide-y divide-govuk-grey-2 rounded-xl border border-govuk-grey-2 bg-white"
          role="list"
        >
          {entries.map((entry) => (
            <Row
              key={entry.userId}
              entry={entry}
              isYou={entry.userId === user.id}
            />
          ))}
        </ol>
      )}
    </div>
  );
}