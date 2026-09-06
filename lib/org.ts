import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role, OrgRole } from "../generated/prisma/client";
import { auditLog } from "./audit";
import { isAuthBypassEnabled, BYPASS_USER } from "./bypass";
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

export async function isOrganizerForYSWS(
  userId: string,
  ywsId: string
): Promise<{ orgId: string; role: OrgRole } | null> {
  const membership = await prisma.organizerYSWSMembership.findFirst({
    where: { userId, yswsId: ywsId },
    include: { org: true },
  });
  if (!membership) return null;
  return { orgId: membership.orgId, role: membership.role };
}

export async function getYSWSForUser(userId: string) {
  const membership = await prisma.organizerYSWSMembership.findFirst({
    where: { userId },
    include: { ysws: true, org: true },
  });
  return {
    yws: membership?.ysws ?? null,
    organizerMembership: membership ?? null,
  };
}

export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return (
    "wom_" +
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

export function generateRecipientToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export async function generateApiKeyHash(key: string): Promise<string> {
  return hash(key, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

export async function verifyApiKeyHash(plainKey: string, hash: string): Promise<boolean> {
  return verify(hash, plainKey);
}

export async function generateApiKeyWithHash(): Promise<{ key: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const key = "wom_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const hash = await generateApiKeyHash(key);
  return { key, hash };
}

export async function generateApiKeyWithExpiry(
  scopes: string[] = ["orders:write"],
  expiresInDays: number = 365
): Promise<{ key: string; hash: string; expiresAt: Date; scopes: string[] }> {
  const { key, hash } = await generateApiKeyWithHash();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  return { key, hash, expiresAt, scopes };
}

// Check if user can access an org's orders (org membership check)
export async function canAccessOrgOrders(
  userId: string,
  orgId: string
): Promise<boolean> {
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  return membership !== null;
}

// Check if user can access a YSWS (via organizer membership)
export async function canAccessYSWS(
  userId: string,
  ywsId: string
): Promise<boolean> {
  const membership = await prisma.organizerYSWSMembership.findFirst({
    where: { userId, yswsId: ywsId },
  });
  return membership !== null;
}

// Get all YSWSes an organizer can access
export async function getOrganizerYSWSes(userId: string) {
  const memberships = await prisma.organizerYSWSMembership.findMany({
    where: { userId },
    include: { ysws: { include: { org: true } } },
  });
  return memberships.map((m) => ({
    orgId: m.orgId,
    yswsId: m.yswsId,
    yswsName: m.ysws?.name,
    orgName: m.ysws?.org?.name,
    role: m.role,
  }));
}

// Get all orders for a YSWS that an organizer can manage
export async function getYSWSOrders(
  userId: string,
  ywsId: string
) {
  // First verify organizer access
  const canAccess = await canAccessYSWS(userId, ywsId);
  if (!canAccess) return [];

  return prisma.passportOrder.findMany({
    where: { yswsId: ywsId },
    orderBy: { createdAt: "desc" },
    include: {
      org: { select: { name: true } },
      recipients: { select: { email: true, name: true } },
    },
  });
}

// Get all YSWSes for an organizer with order counts
export async function getOrganizerYSWSesWithStats(userId: string) {
  const memberships = await prisma.organizerYSWSMembership.findMany({
    where: { userId },
    include: { 
      ysws: { 
        include: { 
          org: true,
          _count: {
            select: { orders: true }
          }
        } 
      } 
    },
  });
  return memberships.map((m) => ({
    orgId: m.orgId,
    yswsId: m.yswsId,
    yswsName: m.ysws?.name,
    yswsSlug: m.ysws?.slug,
    yswsApiKeyDisplay: m.ysws?.apiKeyDisplay,
    orgName: m.ysws?.org?.name,
    role: m.role,
    orderCount: m.ysws?._count.orders ?? 0,
  }));
}