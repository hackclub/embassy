import {
  WEEKLY_LEADERBOARD_DAYS,
  LEADERBOARD_TTL_SECONDS,
  LEADERBOARD_TOP_N,
} from "../constants";
import { getLinkedAccount, fetchTrackedTime } from "../hackatime";
import { redis } from "../redis";
import { prisma } from "../prisma";

export type LeaderboardBucket = "all" | "weekly";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  slackId: string | null;
  seconds: number;
  projectCount: number;
};

function weeklyStartDate(): string {
  return new Date(Date.now() - WEEKLY_LEADERBOARD_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

async function getBucketHours(
  userId: string,
  names: string[],
  bucket: LeaderboardBucket,
): Promise<number | null> {
  const linked = await getLinkedAccount(userId);
  if (!linked || names.length === 0) return null;

  const cacheKey = `hackatime:leaderboard:${userId}:${bucket}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const n = Number(cached);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    // cache best effort
  }
  const map = await fetchTrackedTime(
    linked.accessToken,
    names,
    bucket === "weekly" ? weeklyStartDate() : undefined,
  );
  if (!map) return null;

  let seconds = 0;
  for (const n of names) seconds += map.get(n) ?? 0;
  if (seconds <= 0) return null;

  try {
    await redis.set(cacheKey, String(seconds), "EX", LEADERBOARD_TTL_SECONDS);
  } catch {
    // best effort
  }
  return seconds;
}

export async function getLeaderboard(
  bucket: LeaderboardBucket,
  take: number = LEADERBOARD_TOP_N,
): Promise<LeaderboardEntry[]> {
  const accepted = await prisma.submission.findMany({
    where: { status: "ACCEPTED" },
    select: {
      userId: true,
      project: {
        select: { hackatimeProject: true },
      },
      user: {
        select: { id: true, name: true, image: true, slackId: true },
      },
    },
  });
  
  const namesByUser = new Map<string, Set<string>>();
  for (const s of accepted) {
    if (s.project?.hackatimeProject) {
      if (!namesByUser.has(s.userId)) namesByUser.set(s.userId, new Set());
      namesByUser.get(s.userId)!.add(s.project.hackatimeProject);
    }
  }
  
  if (accepted.length === 0) return [];

  const userById = new Map(accepted.map((s) => [s.user.id, s.user]));

  const scored = (
    await Promise.all(
      [...namesByUser.entries()].map(async ([userId, names]) => {
        const hours = await getBucketHours(userId, [...names], bucket);
        return hours === null
          ? null
          : { userId, hours, projectCount: names.size };
      }),
    )
  )
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, take);

  let prevHours: number | null = null;
  let rank = 0;
  return scored.map((row, i) => {
    if (prevHours === null || row.hours !== prevHours) rank = i + 1;
    prevHours = row.hours;
    const u = userById.get(row.userId)!;
    return {
      rank,
      userId: row.userId,
      name: u.name ?? "Anonymous",
      image: u.image,
      slackId: u.slackId,
      seconds: row.hours,
      projectCount: row.projectCount,
    };
  });
}
