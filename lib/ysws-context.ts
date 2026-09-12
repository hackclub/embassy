import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole, verifyApiKeyHash, API_KEY_PREFIX_LEN } from "@/lib/org";
import { isBypassUser, isAuthBypassEnabled } from "@/lib/bypass";
import type { Role, OrgRole } from "../generated/prisma/client";

export interface YSWSContext {
  userId: string;
  role: Role;
  orgId: string | null;
  accessibleYSWSes: AccessibleYSWS[];
  activeYSWSId: string | null;
  activeYSWS: AccessibleYSWS | null;
}

export interface AccessibleYSWS {
  yswsId: string;
  yswsName: string;
  yswsSlug: string;
  yswsApiKeyDisplay: string | null;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: OrgRole;
  orderCount: number;
  isActive: boolean;
}

export interface APIKeyContext {
  orgId: string;
  yswsId: string | null;
  actorId: string;
  actorType: "api" | "organizer" | "admin";
}

export type ApiScope = "orders:read" | "orders:write";

/**
 * Get the complete YSWS context for the current user.
 * This is the single source of truth for YSWS authorization.
 */
export async function getYSWSContext(): Promise<YSWSContext | null> {
  const user = await getCurrentUserWithRole();
  if (!user) return null;

  // Superadmins and admins can access all YSWSes via org membership
  if (hasRole(user.role, "ADMIN")) {
    const orgs = await prisma.org.findMany({
      // The bypass user is not a member of any org; let them see everything.
      where: isBypassUser(user.id)
        ? {}
        : { members: { some: { userId: user.id } } },
      include: {
        ysws: {
          where: { isActive: true },
          include: {
            _count: { select: { orders: true } },
            organizerMemberships: {
              where: { userId: user.id },
              select: { role: true },
            },
          },
        },
      },
    });

    const accessibleYSWSes: AccessibleYSWS[] = [];
    for (const org of orgs) {
      for (const ysws of org.ysws) {
        const membership = ysws.organizerMemberships[0];
        accessibleYSWSes.push({
          yswsId: ysws.id,
          yswsName: ysws.name,
          yswsSlug: ysws.slug,
          yswsApiKeyDisplay: ysws.apiKeyDisplay,
          orgId: org.id,
          orgName: org.name,
          orgSlug: org.slug,
          role: membership?.role ?? "ORGANIZER",
          orderCount: ysws._count.orders,
          isActive: ysws.isActive,
        });
      }
    }

    return {
      userId: user.id,
      role: user.role,
      orgId: orgs[0]?.id ?? null,
      accessibleYSWSes,
      activeYSWSId: accessibleYSWSes[0]?.yswsId ?? null,
      activeYSWS: accessibleYSWSes[0] ?? null,
    };
  }

  // Organizers can only access YSWSes they have explicit membership for
  const memberships = await prisma.organizerYSWSMembership.findMany({
    where: { userId: user.id },
    include: {
      ysws: {
        include: {
          org: true,
          _count: { select: { orders: true } },
        },
      },
      org: true,
    },
  });

  const accessibleYSWSes: AccessibleYSWS[] = memberships
    .filter((m) => m.ysws?.isActive)
    .map((m) => ({
      yswsId: m.yswsId,
      yswsName: m.ysws!.name,
      yswsSlug: m.ysws!.slug,
      yswsApiKeyDisplay: m.ysws!.apiKeyDisplay,
      orgId: m.orgId,
      orgName: m.org!.name,
      orgSlug: m.org!.slug,
      role: m.role,
      orderCount: m.ysws!._count.orders,
      isActive: m.ysws!.isActive,
    }));

  return {
    userId: user.id,
    role: user.role,
    orgId: memberships[0]?.orgId ?? null,
    accessibleYSWSes,
    activeYSWSId: accessibleYSWSes[0]?.yswsId ?? null,
    activeYSWS: accessibleYSWSes[0] ?? null,
  };
}

/**
 * Verify that a user has access to a specific YSWS.
 * Returns the YSWS if authorized, null otherwise.
 */
export async function verifyYSWSAccess(
  userId: string,
  yswsId: string
): Promise<AccessibleYSWS | null> {
  const user = await getCurrentUserWithRole();
  if (!user || user.id !== userId) return null;

  // Superadmins and admins can access any YSWS in their orgs
  if (hasRole(user.role, "ADMIN")) {
    const ysws = await prisma.ySWS.findUnique({
      where: { id: yswsId },
      include: {
        org: true,
        _count: { select: { orders: true } },
        organizerMemberships: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (!ysws || !ysws.isActive || !ysws.orgId) return null;

    // Check if admin is member of the org (bypass user can access everything)
    if (!isBypassUser(userId)) {
      const orgMember = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: ysws.orgId, userId } },
      });
      if (!orgMember) return null;
    }

    return {
      yswsId: ysws.id,
      yswsName: ysws.name,
      yswsSlug: ysws.slug,
      yswsApiKeyDisplay: ysws.apiKeyDisplay,
      orgId: ysws.orgId,
      orgName: ysws.org!.name,
      orgSlug: ysws.org!.slug,
      role: ysws.organizerMemberships[0]?.role ?? "ORGANIZER",
      orderCount: ysws._count.orders,
      isActive: ysws.isActive,
    };
  }

  // Organizers need explicit YSWS membership
  const membership = await prisma.organizerYSWSMembership.findFirst({
    where: { userId, yswsId },
    include: {
      ysws: { include: { org: true, _count: { select: { orders: true } } } },
      org: true,
    },
  });

  if (!membership || !membership.ysws?.isActive) return null;

  return {
    yswsId: membership.ysws.id,
    yswsName: membership.ysws.name,
    yswsSlug: membership.ysws.slug,
    yswsApiKeyDisplay: membership.ysws.apiKeyDisplay,
    orgId: membership.orgId,
    orgName: membership.org!.name,
    orgSlug: membership.org!.slug,
    role: membership.role,
    orderCount: membership.ysws._count.orders,
    isActive: membership.ysws.isActive,
  };
}

const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

async function touchApiKeyLastUsed(yswsId: string, lastUsed: Date | null): Promise<void> {
  if (lastUsed && Date.now() - lastUsed.getTime() < LAST_USED_THROTTLE_MS) return;
  try {
    await prisma.ySWS.update({
      where: { id: yswsId },
      data: { apiKeyLastUsed: new Date() },
    });
  } catch {
    // bookkeeping only — never fail auth because of it
  }
}

/**
 * Resolve organization context from API key or session.
 * Used by /api/orders route.
 */
export async function resolveAPIKeyContext(
  req: Request,
  requiredScope?: ApiScope
): Promise<APIKeyContext | null> {
  const authHeader = req.headers.get("authorization");
  const apiKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : req.headers.get("x-api-key")?.trim() ?? null;

  if (apiKey) {
    if (!apiKey.startsWith("wom_") || apiKey.length < API_KEY_PREFIX_LEN + 8) {
      return null;
    }

    // Fast path: candidate rows whose stored prefix matches — one argon2
    // verify instead of one per org on every (unauthenticated) request.
    const prefix = apiKey.slice(0, API_KEY_PREFIX_LEN);
    let candidates = await prisma.ySWS.findMany({
      where: { isActive: true, apiKeyPrefix: prefix },
      include: { org: true },
    });
    // Legacy rows created before prefixes were stored still get checked.
    if (candidates.length === 0) {
      candidates = await prisma.ySWS.findMany({
        where: { isActive: true, apiKeyPrefix: null, apiKeyHash: { not: null } },
        include: { org: true },
      });
    }

    for (const ysws of candidates) {
      if (!ysws.apiKeyHash || !ysws.orgId) continue;
      if (!(await verifyApiKeyHash(apiKey, ysws.apiKeyHash))) continue;
      if (ysws.apiKeyExpiresAt && ysws.apiKeyExpiresAt.getTime() < Date.now()) {
        return null; // valid key, but expired — do not fall through
      }
      if (requiredScope && ysws.apiKeyScopes.length > 0 && !ysws.apiKeyScopes.includes(requiredScope)) {
        return null; // valid key, but lacks scope
      }
      await touchApiKeyLastUsed(ysws.id, ysws.apiKeyLastUsed);
      return { orgId: ysws.orgId, yswsId: ysws.id, actorId: "api", actorType: "api" };
    }
    return null;
  }

  const session = await auth();
  if (!session?.user?.id && !isAuthBypassEnabled()) return null;

  const user = await getCurrentUserWithRole();
  if (!user) return null;

  // For session users, find their org membership
  const membership = await prisma.orgMember.findFirst({
    where: { userId: user.id },
    orderBy: { id: "asc" },
    include: { org: true },
  });

  if (!membership) {
    // Bypass user has no org membership; fall back to the first org so the
    // orders API stays testable without signing in.
    if (isBypassUser(user.id)) {
      const org = await prisma.org.findFirst({ orderBy: { createdAt: "asc" } });
      if (!org) return null;
      const ysws = await prisma.ySWS.findFirst({
        where: { orgId: org.id, isActive: true },
      });
      return {
        orgId: org.id,
        yswsId: ysws?.id ?? null,
        actorId: user.id,
        actorType: "admin",
      };
    }
    return null;
  }

  // Get the YSWS for this org
  const ysws = await prisma.ySWS.findFirst({
    where: { orgId: membership.orgId, isActive: true },
  });

  return {
    orgId: membership.orgId,
    yswsId: ysws?.id ?? null,
    actorId: user.id,
    actorType: hasRole(user.role, "ADMIN") ? "admin" : "organizer",
  };
}
