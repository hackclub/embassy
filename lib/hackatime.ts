import { prisma } from "@/lib/prisma";
import { isBypassUser } from "@/lib/bypass";

const HACKATIME = {
  authorizeUrl: "https://hackatime.hackclub.com/oauth/authorize",
  tokenUrl: "https://hackatime.hackclub.com/oauth/token",
  meUrl: "https://hackatime.hackclub.com/api/v1/authenticated/me",
  hoursUrl: "https://hackatime.hackclub.com/api/v1/authenticated/hours",
} as const;

export const HACKATIME_STATE_COOKIE = "hackatime_oauth_state";

export type HackatimeMe = {
  id: number;
  emails: string[];
  slack_id?: string;
  github_username?: string;
};

export function isHackatimeConfigured(): boolean {
  return Boolean(
    process.env.AUTH_HACKATIME_CLIENT_ID && process.env.AUTH_HACKATIME_CLIENT_SECRET
  );
}

export function getRedirectUri(origin: string): string {
  return `${origin}/api/hackatime/callback`;
}

export function buildAuthorizeUrl(origin: string, state: string): string {
  const url = new URL(HACKATIME.authorizeUrl);
  url.searchParams.set("client_id", process.env.AUTH_HACKATIME_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", getRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile read");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(
  code: string,
  origin: string
): Promise<{ access_token: string } | null> {
  try {
    const res = await fetch(HACKATIME.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_HACKATIME_CLIENT_ID ?? "",
        client_secret: process.env.AUTH_HACKATIME_CLIENT_SECRET ?? "",
        code,
        redirect_uri: getRedirectUri(origin),
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: unknown };
    if (typeof data.access_token !== "string" || !data.access_token) return null;
    return { access_token: data.access_token };
  } catch {
    return null;
  }
}

export async function fetchMe(token: string): Promise<HackatimeMe | null> {
  try {
    const res = await fetch(HACKATIME.meUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data.id !== "number") return null;
    return {
      id: data.id,
      emails: Array.isArray(data.emails) ? (data.emails as string[]) : [],
      slack_id: typeof data.slack_id === "string" ? data.slack_id : undefined,
      github_username:
        typeof data.github_username === "string" ? data.github_username : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchTotalHours(token: string): Promise<number | null> {
  try {
    const end = new Date().toISOString().slice(0, 10);
    const url = `${HACKATIME.hoursUrl}?${new URLSearchParams({
      start_date: "1970-01-01",
      end_date: end,
    })}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { total_seconds?: unknown };
    const seconds = Number(data.total_seconds);
    if (!Number.isFinite(seconds)) return null;
    return Math.floor((seconds / 3600) * 100) / 100;
  } catch {
    return null;
  }
}

export async function linkUser(
  userId: string,
  hackatimeUid: string,
  token: { access_token: string }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "hackatime",
          providerAccountId: hackatimeUid,
        },
      },
    });
    if (existing && existing.userId !== userId) {
      await tx.account.delete({ where: { id: existing.id } });
    }
    await tx.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "hackatime",
          providerAccountId: hackatimeUid,
        },
      },
      update: {
        userId,
        type: "oauth",
        access_token: token.access_token,
        token_type: "Bearer",
        scope: "profile read",
      },
      create: {
        userId,
        type: "oauth",
        provider: "hackatime",
        providerAccountId: hackatimeUid,
        access_token: token.access_token,
        token_type: "Bearer",
        scope: "profile read",
      },
    });
    // User.hackatimeUid is unique — release it from any previous owner first.
    await tx.user.updateMany({
      where: { hackatimeUid, NOT: { id: userId } },
      data: { hackatimeUid: null, hackatimeLinkedAt: null },
    });
    await tx.user.update({
      where: { id: userId },
      data: { hackatimeUid, hackatimeLinkedAt: new Date() },
    });
  });
}

export async function getLinkedAccount(
  userId: string
): Promise<{ hackatimeUid: string; accessToken: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hackatimeUid: true },
  });
  if (!user?.hackatimeUid) return null;
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "hackatime",
        providerAccountId: user.hackatimeUid,
      },
    },
  });
  if (!account?.access_token) return null;
  return { hackatimeUid: user.hackatimeUid, accessToken: account.access_token };
}

export async function unlinkUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId, provider: "hackatime" } }),
    prisma.user.update({
      where: { id: userId },
      data: { hackatimeUid: null, hackatimeLinkedAt: null },
    }),
  ]);
}

export async function getHackatimeHours(userId: string): Promise<number | null> {
  if (isBypassUser(userId) && process.env.ADMIN_BYPASS_HOURS) {
    const hours = Number(process.env.ADMIN_BYPASS_HOURS);
    return Number.isFinite(hours) ? hours : null;
  }
  try {
    const linked = await getLinkedAccount(userId);
    if (!linked) return null;
    return await fetchTotalHours(linked.accessToken);
  } catch {
    return null;
  }
}
