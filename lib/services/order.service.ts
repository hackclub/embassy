import { prisma } from "../prisma";
import { generateRecipientToken, generateApiKeyWithHash } from "../org";
import { auditLog } from "../audit";
import { getRequestId } from "../request-id";
import { createEmailDelivery } from "./email.service";
import type { OrderTransition, OrderStatus, EventType } from "../../generated/prisma/enums";
import type { ActorType } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";

export interface CreateOrderInput {
  orgId: string;
  yswsId: string;
  recipientName: string;
  recipientEmail: string;
  note?: string | null;
  createdByUserId?: string | null;
  createdFrom: "api" | "dashboard" | "admin";
}

export interface OrderWithRelations {
  id: string;
  orgId: string;
  yswsId: string;
  totalQuantity: number;
  currentState: OrderTransition;
  status: OrderStatus;
  note: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientToken: string | null;
  createdFrom: string;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  org: { id: string; name: string; slug: string };
  ysws: { id: string; name: string; slug: string; apiKeyHash: string | null };
  recipients: Array<{ id: string; email: string; name: string | null }>;
  versions: Array<{ id: string; version: number; createdAt: Date }>;
  shipments: Array<{ id: string; trackingNumber: string | null; carrier: string | null }>;
  events: Array<{ id: string; eventType: EventType; createdAt: Date }>;
}

export async function createOrder(input: CreateOrderInput) {
  const recipientToken = generateRecipientToken();
  const linkedUser = await prisma.user.findUnique({
    where: { email: input.recipientEmail },
    select: { id: true },
  });

  const order = await prisma.passportOrder.create({
    data: {
      orgId: input.orgId,
      yswsId: input.yswsId,
      totalQuantity: 1,
      currentState: "AWAITING_RECIPIENT_DETAILS",
      status: "PENDING",
      note: input.note ?? null,
      createdFrom: input.createdFrom,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      recipientToken,
      createdByUserId: linkedUser?.id ?? input.createdByUserId ?? null,
      recipients: {
        create: {
          email: input.recipientEmail,
          name: input.recipientName,
          userId: linkedUser?.id ?? null,
        },
      },
    },
    include: {
      org: { select: { id: true, name: true, slug: true } },
      ysws: { select: { id: true, name: true, slug: true, apiKeyHash: true } },
      recipients: { select: { id: true, email: true, name: true } },
    },
  });

  await createOrderEvent({
    orderId: order.id,
    eventType: "ORDER_CREATED",
    status: "PENDING",
    newState: "AWAITING_RECIPIENT_DETAILS",
    actor: input.createdByUserId ?? "system",
    actorType: "SYSTEM",
    description: `Passport order created for ${input.recipientName}`,
  });

  await createEmailDelivery({
    orderId: order.id,
    recipientEmail: input.recipientEmail,
    eventType: "EMAIL_SENT",
    status: "pending",
  });

  return order;
}

export async function getOrderById(id: string): Promise<OrderWithRelations | null> {
  return prisma.passportOrder.findUnique({
    where: { id },
    include: {
      org: { select: { id: true, name: true, slug: true } },
      ysws: { select: { id: true, name: true, slug: true, apiKeyHash: true } },
      recipients: { select: { id: true, email: true, name: true } },
      versions: { orderBy: { version: "desc" }, take: 5 },
      shipments: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getOrderByToken(token: string) {
  return prisma.passportOrder.findUnique({
    where: { recipientToken: token },
    include: { org: true, ysws: true, recipients: true },
  });
}

export async function getOrdersByYSWS(yswsId: string, options?: { take?: number; cursor?: string }) {
  return prisma.passportOrder.findMany({
    where: { yswsId },
    orderBy: { createdAt: "desc" },
    take: options?.take ?? 50,
    cursor: options?.cursor ? { id: options.cursor } : undefined,
    include: {
      org: { select: { name: true } },
      recipients: { select: { email: true, name: true } },
    },
  });
}

export async function getOrdersByOrg(orgId: string, options?: { take?: number; cursor?: string }) {
  return prisma.passportOrder.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: options?.take ?? 50,
    cursor: options?.cursor ? { id: options.cursor } : undefined,
    include: {
      ysws: { select: { name: true } },
      recipients: { select: { email: true, name: true } },
    },
  });
}

export interface UpdateOrderStateInput {
  orderId: string;
  newState: OrderTransition;
  actor: string;
  actorType: ActorType;
  description?: string;
  status?: OrderStatus;
}

export async function updateOrderState(input: UpdateOrderStateInput) {
  const order = await prisma.passportOrder.findUnique({
    where: { id: input.orderId },
    select: { currentState: true, status: true, recipientEmail: true },
  });

  if (!order) throw new Error("Order not found");

  const previousState = order.currentState;

  await prisma.passportOrder.update({
    where: { id: input.orderId },
    data: {
      currentState: input.newState,
      status: input.status ?? order.status,
    },
  });

  await createOrderEvent({
    orderId: input.orderId,
    eventType: "STATUS_CHANGED",
    status: input.status ?? order.status,
    previousState,
    newState: input.newState,
    actor: input.actor,
    actorType: input.actorType,
    description: input.description ?? `State changed from ${previousState} to ${input.newState}`,
  });

  return { previousState, newState: input.newState };
}

export async function createOrderEvent(input: {
  orderId: string;
  eventType: EventType;
  status?: OrderStatus | null;
  previousState?: OrderTransition | null;
  newState: OrderTransition;
  actor: string;
  actorType: ActorType;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.orderEvent.create({
    data: {
      orderId: input.orderId,
      eventType: input.eventType,
      status: input.status ?? null,
      previousState: input.previousState ?? null,
      newState: input.newState,
      actor: input.actor,
      actorType: input.actorType,
      description: input.description,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });
}

export async function regenerateApiKey(yswsId: string, actorId: string) {
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