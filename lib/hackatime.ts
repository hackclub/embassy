import { prisma } from "@/lib/prisma";
import { isBypassUser } from "@/lib/bypass";
import { encryptPII, decryptPII } from "@/lib/encryption";

const HACKATIME = {
  authorizeUrl: "https://hackatime.hackclub.com/oauth/authorize",
  tokenUrl: "https://hackatime.hackclub.com/oauth/token",
  meUrl: "https://hackatime.hackclub.com/api/v1/authenticated/me",
  hoursUrl: "https://hackatime.hackclub.com/api/v1/authenticated/hours",
  projectsUrl: "https://hackatime.hackclub.com/api/v1/authenticated/projects",
} as const;

export const HACKATIME_STATE_COOKIE = "hackatime_oauth_state";

/**
 * Cookie name for the OAuth state. With an https AUTH_URL we can use the
 * __Host- prefix (secure + path=/ + no domain), which prevents other
 * subdomains from planting a state cookie; on plain http (dev) fall back to
 * the bare name since __Host- would be rejected by browsers.
 */
export function stateCookieName(): string {
  return getBaseUrl().startsWith("https://")
    ? `__Host-${HACKATIME_STATE_COOKIE}`
    : HACKATIME_STATE_COOKIE;
}

export type HackatimeMe = {
  id: number;
  emails: string[];
  slack_id?: string;
  github_username?: string;
};

export function isHackatimeConfigured(): boolean {
  const id = process.env.AUTH_HACKATIME_CLIENT_ID ?? "";
  const secret = process.env.AUTH_HACKATIME_CLIENT_SECRET ?? "";
  const placeholder = (v: string) => !v || v.trim().toLowerCase() === "placeholder";
  return !placeholder(id) && !placeholder(secret);
}

/**
 * Find canonical Base URL. Prefers AUTH_URL.
 * Default: env: AUTH_URL
 * Fallback: Headers (req origin)
 */
export function getBaseUrl(origin?: string): string {
  const envUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (envUrl) {
    try {
      return new URL(envUrl).origin;
    } catch {
      // fall through: request origin
    }
  }
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      // fall through
    }
  }
  return "http://localhost:3000";
}

export function getRedirectUri(origin?: string): string {
  return `${getBaseUrl(origin)}/api/hackatime/callback`;
}

export function buildAuthorizeUrl(state: string, origin?: string): string {
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
  origin?: string
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

const IGNORED_PROJECTS = new Set(["<<LAST_PROJECT>>", "Other"]);

export async function fetchProjects(
  token: string
): Promise<string[] | null> {
  try {
    const res = await fetch(HACKATIME.projectsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      projects?: Array<{ name?: unknown; archived?: unknown }>;
    };
    if (!Array.isArray(data.projects)) return null;
    const names = data.projects
      .filter((p) => !p.archived && typeof p.name === "string")
      .map((p) => (p.name as string).trim())
      .filter((n) => n.length > 0 && !IGNORED_PROJECTS.has(n));
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  } catch {
    return null;
  }
}

export class HackatimeAlreadyLinkedException extends Error {
  constructor() {
    super("This Hackatime account is already linked to another user");
    this.name = "HackatimeAlreadyLinkedException";
  }
}

export async function linkUser(
  userId: string,
  hackatimeUid: string,
  token: { access_token: string }
): Promise<void> {
  // Encrypt at rest — never keep the raw Hackatime token in the DB.
  const accessToken = await encryptPII(token.access_token);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "hackatime",
          providerAccountId: hackatimeUid,
        },
      },
    });
    const existingUser = await tx.user.findFirst({
      where: { hackatimeUid },
      select: { id: true },
    });
    // A Hackatime id already owned by someone else must never be stolen:
    // unlink the rightful owner first (they can re-link with their own login).
    if (
      (existing && existing.userId !== userId) ||
      (existingUser && existingUser.id !== userId)
    ) {
      throw new HackatimeAlreadyLinkedException();
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
        access_token: accessToken,
        token_type: "Bearer",
        scope: "profile read",
      },
      create: {
        userId,
        type: "oauth",
        provider: "hackatime",
        providerAccountId: hackatimeUid,
        access_token: accessToken,
        token_type: "Bearer",
        scope: "profile read",
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        hackatimeUid,
        hackatimeLinkedAt: new Date(),
        hackatimeTokenEncrypted: accessToken,
      },
    });
  });
}

export async function getLinkedAccount(
  userId: string
): Promise<{ hackatimeUid: string; accessToken: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hackatimeUid: true, hackatimeTokenEncrypted: true },
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

  // Prefer the dedicated field; fall back to the account row (may be legacy
  // plaintext from before encryption, so decrypt-when-possible).
  const stored = user.hackatimeTokenEncrypted || account?.access_token || null;
  if (!stored) return null;

  let accessToken: string;
  try {
    // May be legacy plaintext from before encryption, so decrypt-when-possible.
    const plain = await decryptPII(stored);
    accessToken = plain || stored;
  } catch {
    return null;
  }
  if (!accessToken) return null;
  return { hackatimeUid: user.hackatimeUid, accessToken };
}

export async function unlinkUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId, provider: "hackatime" } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        hackatimeUid: null,
        hackatimeLinkedAt: null,
        hackatimeTokenEncrypted: null,
      },
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
