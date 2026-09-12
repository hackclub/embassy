import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role, OrgRole } from "../generated/prisma/client";
import { auditLog } from "./audit";
import { isAuthBypassEnabled, BYPASS_USER } from "./bypass";
import { setSentryUserContext } from "./sentry";
import { hash, verify } from "@node-rs/argon2";

export type { Role, OrgRole };

export const ROLE_RANK: Record<Role, number> = {
  PARTICIPANT: 0,
  ORGANIZER: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

export const ROLE_LABEL: Record<Role, string> = {
  PARTICIPANT: "Participant",
  ORGANIZER: "Organizer",
  ADMIN: "Admin",
  SUPERADMIN: "Superadmin",
};

export function hasRole(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPERADMIN_EMAILS.includes(email.toLowerCase().trim());
}

export async function getCurrentUser() {
  const session = await auth();
  if (session?.user?.id) return session.user;

  // ADMIN_BYPASS=true: allow testing everything without signing in.
  // A synthetic superadmin user row is created so foreign keys and
  // user-scoped queries keep working.
  if (isAuthBypassEnabled()) {
    await prisma.user.upsert({
      where: { id: BYPASS_USER.id },
      update: { role: "SUPERADMIN" },
      create: {
        id: BYPASS_USER.id,
        name: BYPASS_USER.name,
        email: BYPASS_USER.email,
        role: "SUPERADMIN",
      },
    });
    return BYPASS_USER;
  }

  return null;
}

export async function getCurrentUserWithRole(): Promise<
  (NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> & { role: Role }) | null
> {
  const user = await getCurrentUser();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (!dbUser) return null;

  // DB role is the source of truth
  let role = dbUser.role;

  // Attribute everything on this request to the current user in Sentry.
  setSentryUserContext({ id: user.id, email: user.email ?? undefined, role });

  // Only use SUPERADMIN_EMAILS as fallback for bootstrap (when DB role is PARTICIPANT)
  const email = user.email?.toLowerCase().trim();
  if (email && SUPERADMIN_EMAILS.includes(email) && role === "PARTICIPANT") {
    console.warn(
      `[SUPERADMIN_EMAILS] Granting SUPERADMIN via env var for ${email} (DB role: ${role})`
    );
    await auditLog({
      entityType: "User",
      entityId: user.id,
      action: "ROLE_ESCALATED_VIA_ENV",
      actor: user.id,
      actorType: "SYSTEM",
      beforeValue: { role },
      afterValue: { role: "SUPERADMIN", source: "SUPERADMIN_EMAILS" },
      description: `SUPERADMIN granted via SUPERADMIN_EMAILS env var for ${email}`,
    });
    role = "SUPERADMIN";
  }

  return { ...user, role };
}

export async function getOrgForUser(userId: string) {
  const membership = await prisma.orgMember.findFirst({
    where: { userId },
    orderBy: { id: "asc" },
    include: {
      org: {
        include: {
          orders: {
            orderBy: { createdAt: "desc" },
            include: {
              user: { select: { name: true, email: true } },
              ysws: { select: { name: true } },
            },
          },
          ysws: {
            select: { apiKeyDisplay: true, name: true, slug: true },
          },
        },
      },
    },
  });
  return membership?.org ?? null;
}

export async function isOrgMember(userId: string, orgId: string): Promise<boolean> {
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  return membership !== null;
}

export const API_KEY_PREFIX_LEN = 8;

export function generateRecipientToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

function randomApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return (
    "wom_" +
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

export async function generateApiKeyHash(key: string): Promise<string> {
  return hash(key, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

export async function verifyApiKeyHash(plainKey: string, keyHash: string): Promise<boolean> {
  return verify(keyHash, plainKey);
}

export interface GeneratedApiKey {
  key: string;
  hash: string;
  prefix: string;
  display: string;
  expiresAt: Date | null;
  scopes: string[];
}

export async function generateApiKeyWithExpiry(
  scopes: string[] = ["orders:read", "orders:write"],
  expiresInDays: number = 365
): Promise<GeneratedApiKey> {
  const key = randomApiKey();
  return {
    key,
    hash: await generateApiKeyHash(key),
    // Prefix is indexed for O(1) candidate lookup during auth; it only ever
    // exposes the first 8 of 48 random chars (5e9 space) to anyone who can
    // read the DB.
    prefix: key.slice(0, API_KEY_PREFIX_LEN),
    display: key.slice(-4),
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    scopes,
  };
}

export async function generateApiKeyWithHash(): Promise<GeneratedApiKey> {
  return generateApiKeyWithExpiry();
}
