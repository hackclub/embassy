import { prisma } from "../prisma";
import { hasRole, isSuperadminEmail, generateApiKeyWithHash } from "../org";
import { auditLog } from "../audit";
import { getRequestId } from "../request-id";
import type { Role, OrgRole } from "../../generated/prisma/enums";

export interface OrgWithDetails {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  ysws: Array<{
    id: string;
    name: string;
    slug: string;
    apiKeyHash: string | null;
    isActive: boolean;
    _count: { orders: number };
  }>;
  _count: { members: number; orders: number };
}

export async function getOrgForUser(userId: string) {
  const membership = await prisma.orgMember.findFirst({
    where: { userId },
    include: {
      org: {
        include: {
          ysws: {
            where: { isActive: true },
            select: { id: true, name: true, slug: true, apiKeyHash: true, _count: { select: { orders: true } } },
          },
          _count: { select: { members: true, orders: true } },
        },
      },
    },
  });
  return membership?.org ?? null;
}

export async function getOrgById(id: string): Promise<OrgWithDetails | null> {
  return prisma.org.findUnique({
    where: { id },
    include: {
      ysws: {
        where: { isActive: true },
        select: { id: true, name: true, slug: true, apiKeyHash: true, isActive: true, _count: { select: { orders: true } } },
      },
      _count: { select: { members: true, orders: true } },
    },
  });
}

export async function getOrgsForAdmin(userId: string, userRole: Role) {
  if (hasRole(userRole, "ADMIN")) {
    return prisma.org.findMany({
      where: { members: { some: { userId } } },
      include: {
        ysws: {
          where: { isActive: true },
          select: { id: true, name: true, slug: true, apiKeyHash: true, isActive: true, _count: { select: { orders: true } } },
        },
        _count: { select: { members: true, orders: true } },
      },
    });
  }
  return [];
}

export async function createOrgWithYSWS(input: {
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  ownerEmail: string;
}) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.org.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
      },
    });

    const ysws = await tx.ySWS.create({
      data: {
        name: org.name,
        slug: org.slug,
        apiKeyHash: (await generateApiKeyWithHash()).hash,
        isActive: true,
        orgId: org.id,
      },
    });

    await tx.orgMember.create({
      data: { orgId: org.id, userId: input.ownerId, role: "OWNER" },
    });

    await tx.organizerYSWSMembership.create({
      data: { orgId: org.id, userId: input.ownerId, yswsId: ysws.id, role: "OWNER" },
    });

    const currentUser = await tx.user.findUnique({
      where: { id: input.ownerId },
      select: { role: true, email: true },
    });

    const isSuperadmin = currentUser?.email ? isSuperadminEmail(currentUser.email) : false;
    if (currentUser?.role === "PARTICIPANT" && !isSuperadmin) {
      await tx.user.update({
        where: { id: input.ownerId },
        data: { role: "ORGANIZER" },
      });
    }

    await auditLog({
      entityType: "Org",
      entityId: org.id,
      action: "CREATED",
      actor: input.ownerId,
      actorType: "ADMIN",
      description: `Created org ${org.name} with YSWS ${ysws.name}`,
      afterValue: { orgId: org.id, yswsId: ysws.id },
      requestId: await getRequestId(),
    });

    return { org, ysws };
  });
}

export async function updateOrg(id: string, data: { name?: string; description?: string; color?: string }) {
  return prisma.org.update({
    where: { id },
    data,
  });
}

export async function deleteOrg(id: string) {
  return prisma.org.delete({ where: { id } });
}

export async function addOrganizerToYSWS(input: {
  orgId: string;
  userId: string;
  yswsId: string;
  role: OrgRole;
  actorId: string;
}) {
  const membership = await prisma.organizerYSWSMembership.upsert({
    where: { orgId_userId_yswsId: { orgId: input.orgId, userId: input.userId, yswsId: input.yswsId } },
    create: {
      orgId: input.orgId,
      userId: input.userId,
      yswsId: input.yswsId,
      role: input.role,
    },
    update: { role: input.role },
  });

  await auditLog({
    entityType: "OrganizerYSWSMembership",
    entityId: membership.id,
    action: "CREATED",
    actor: input.actorId,
    actorType: "ADMIN",
    description: `Added organizer to YSWS`,
    afterValue: { orgId: input.orgId, userId: input.userId, yswsId: input.yswsId, role: input.role },
    requestId: await getRequestId(),
  });

  return membership;
}

export async function removeOrganizerFromYSWS(orgId: string, userId: string, yswsId: string, actorId: string) {
  await prisma.organizerYSWSMembership.delete({
    where: { orgId_userId_yswsId: { orgId, userId, yswsId } },
  });

  await auditLog({
    entityType: "OrganizerYSWSMembership",
    entityId: `${orgId}:${userId}:${yswsId}`,
    action: "DELETED",
    actor: actorId,
    actorType: "ADMIN",
    description: `Removed organizer from YSWS`,
    requestId: await getRequestId(),
  });
}

export async function getOrganizerYSWSes(userId: string) {
  return prisma.organizerYSWSMembership.findMany({
    where: { userId },
    include: {
      ysws: { include: { org: true, _count: { select: { orders: true } } } },
      org: true,
    },
  });
}

export async function getOrganizerYSWSesWithStats(userId: string) {
  const memberships = await prisma.organizerYSWSMembership.findMany({
    where: { userId },
    include: {
      ysws: { include: { org: true, _count: { select: { orders: true } } } },
      org: true,
    },
  });
  return memberships.map((m) => ({
    orgId: m.orgId,
    yswsId: m.yswsId,
    yswsName: m.ysws?.name,
    yswsSlug: m.ysws?.slug,
    yswsApiKey: m.ysws?.apiKeyHash,
    orgName: m.ysws?.org?.name,
    role: m.role,
    orderCount: m.ysws?._count.orders ?? 0,
  }));
}

export async function verifyYSWSAccess(
  userId: string,
  yswsId: string,
  requiredRole: Role = "ORGANIZER"
): Promise<{ orgId: string; role: OrgRole } | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return null;

  if (hasRole(user.role, "ADMIN")) {
    const ysws = await prisma.ySWS.findUnique({
      where: { id: yswsId },
      include: {
        org: true,
        organizerMemberships: { where: { userId }, select: { role: true } },
      },
    });
    if (!ysws || !ysws.isActive || !ysws.orgId) return null;

    const orgMember = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: ysws.orgId, userId } },
    });
    if (!orgMember) return null;

    return { orgId: ysws.orgId, role: ysws.organizerMemberships[0]?.role ?? "ORGANIZER" };
  }

  const membership = await prisma.organizerYSWSMembership.findFirst({
    where: { userId, yswsId },
    include: { ysws: { include: { org: true } }, org: true },
  });
  if (!membership || !membership.ysws?.isActive) return null;

  return { orgId: membership.orgId, role: membership.role };
}

export async function getYSWSById(yswsId: string) {
  return prisma.ySWS.findUnique({
    where: { id: yswsId },
    include: {
      org: true,
      organizerMemberships: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      _count: { select: { orders: true, organizerMemberships: true } },
    },
  });
}

export async function getAllYSWSes() {
  return prisma.ySWS.findMany({
    orderBy: { name: "asc" },
    include: {
      org: { select: { id: true, name: true } },
      _count: { select: { orders: true, organizerMemberships: true } },
    },
  });
}

export async function updateYSWS(yswsId: string, data: { name?: string; slug?: string; isActive?: boolean }) {
  return prisma.ySWS.update({ where: { id: yswsId }, data });
}

export async function regenerateYSWSApiKey(yswsId: string, actorId: string) {
  const ysws = await prisma.ySWS.findUnique({ where: { id: yswsId } });
  if (!ysws) throw new Error("YSWS not found");

  const { key, hash } = await generateApiKeyWithHash();
  await prisma.ySWS.update({
    where: { id: yswsId },
    data: { apiKeyHash: hash, apiKeyDisplay: key.slice(-4) },
  });

  await auditLog({
    entityType: "YSWS",
    entityId: yswsId,
    action: "API_KEY_REGENERATED",
    actor: actorId,
    actorType: "ORGANIZER",
    description: `API key regenerated for YSWS ${ysws.name}`,
    requestId: await getRequestId(),
  });

  return key;
}

export async function setUserRole(email: string, role: Role, actorId: string) {
  const target = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!target) throw new Error("User not found");

  const beforeRole = target.role;
  await prisma.user.update({ where: { id: target.id }, data: { role } });

  await auditLog({
    entityType: "User",
    entityId: target.id,
    action: "ROLE_CHANGED",
    actor: actorId,
    actorType: "ADMIN",
    description: `Role changed from ${beforeRole} to ${role}`,
    beforeValue: { role: beforeRole },
    afterValue: { role },
    requestId: await getRequestId(),
  });

  return target;
}