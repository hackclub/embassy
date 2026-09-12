import { prisma } from "../prisma";
import type { OrderTransition, OrderStatus, EventType } from "../../generated/prisma/enums";
import type { ActorType } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";

export interface UpdateOrderStateInput {
  orderId: string;
  newState: OrderTransition;
  actor: string;
  actorType: ActorType;
  description?: string;
  status?: OrderStatus;
}

// The order pipeline is linear; CANCELLED/ERROR are reachable from any
// non-terminal state and can be recovered to RECIPIENT_DETAILS_RECEIVED.
const LINEAR_FLOW: OrderTransition[] = [
  "AWAITING_RECIPIENT_DETAILS",
  "RECIPIENT_DETAILS_RECEIVED",
  "DRAFTING",
  "DRAFT_READY",
  "SENT_TO_HQ",
  "RECEIVED_FROM_HQ",
  "SHIPPING",
  "DELIVERED",
];

const TERMINAL = new Set<OrderTransition>(["CANCELLED", "ERROR"]);

export function isValidOrderTransition(
  from: OrderTransition,
  to: OrderTransition
): boolean {
  if (from === to) return false;
  // Delivered is final; cancelled/errored can only recover to intake.
  if (from === "DELIVERED") return false;
  if (TERMINAL.has(from)) return to === "RECIPIENT_DETAILS_RECEIVED";
  if (TERMINAL.has(to)) return true;
  const fromIdx = LINEAR_FLOW.indexOf(from);
  const toIdx = LINEAR_FLOW.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1;
}

export class InvalidOrderTransitionError extends Error {
  constructor(from: OrderTransition, to: OrderTransition) {
    super(`Invalid order transition: ${from} -> ${to}`);
    this.name = "InvalidOrderTransitionError";
  }
}

export async function updateOrderState(input: UpdateOrderStateInput) {
  const order = await prisma.passportOrder.findUnique({
    where: { id: input.orderId },
    select: { currentState: true, status: true },
  });

  if (!order) throw new Error("Order not found");
  if (!isValidOrderTransition(order.currentState, input.newState)) {
    throw new InvalidOrderTransitionError(order.currentState, input.newState);
  }

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
