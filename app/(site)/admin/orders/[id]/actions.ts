"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { auditLog } from "@/lib/audit";
import { updateOrderState, InvalidOrderTransitionError } from "@/lib/services/order.service";
import { deliverOrderEmail } from "@/lib/services/email.service";
import type { OrderTransition, OrderStatus } from "@/generated/prisma/client";

export type OrderFormState = { error?: string; ok?: string } | undefined;

const editOrderSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(2, "Enter the recipient's name")
    .max(80, "Name is too long"),
  recipientEmail: z.string().trim().email("Enter a valid recipient email"),
  note: z.string().trim().max(300, "Note is too long").optional(),
});

export async function updateOrderDetailsAction(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  const actor = await getCurrentUserWithRole();
  if (!actor) redirect("/api/auth/signin?callbackUrl=/admin");
  if (!hasRole(actor.role, "ADMIN")) {
    return { error: "Only admins can edit orders." };
  }

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order." };

  const order = await prisma.passportOrder.findUnique({
    where: { id: orderId },
    select: { id: true, recipientEmail: true, recipientName: true, note: true },
  });
  if (!order) return { error: "Order not found." };

  const parsed = editOrderSchema.safeParse({
    recipientName: formData.get("recipientName"),
    recipientEmail: formData.get("recipientEmail"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const email = parsed.data.recipientEmail.toLowerCase();
  const emailChanged = email !== order.recipientEmail;

  const linkedUser = emailChanged
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : null;

  await prisma.passportOrder.update({
    where: { id: orderId },
    data: {
      recipientName: parsed.data.recipientName,
      recipientEmail: email,
      note: parsed.data.note ?? null,
      ...(emailChanged ? { recipientUserId: linkedUser?.id ?? null } : {}),
      ...(emailChanged
        ? {
            recipients: {
              updateMany: {
                where: { orderId, email: order.recipientEmail ?? "" },
                data: {
                  email,
                  name: parsed.data.recipientName,
                  userId: linkedUser?.id ?? null,
                },
              },
            },
          }
        : {
            recipients: {
              updateMany: {
                where: { orderId, email: email },
                data: { name: parsed.data.recipientName },
              },
            },
          }),
    },
  });

  await auditLog({
    entityType: "PassportOrder",
    entityId: orderId,
    action: "ORDER_UPDATED",
    actor: actor.id,
    actorType: "ADMIN",
    beforeValue: {
      recipientName: order.recipientName,
      recipientEmail: order.recipientEmail,
      note: order.note,
    },
    afterValue: {
      recipientName: parsed.data.recipientName,
      recipientEmail: email,
      note: parsed.data.note ?? null,
    },
    description: `Order details updated by ${actor.name ?? actor.email}`,
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: "Order updated." };
}

const stateSchema = z.object({
  currentState: z.enum([
    "AWAITING_RECIPIENT_DETAILS",
    "RECIPIENT_DETAILS_RECEIVED",
    "DRAFTING",
    "DRAFT_READY",
    "SENT_TO_HQ",
    "RECEIVED_FROM_HQ",
    "SHIPPING",
    "DELIVERED",
    "CANCELLED",
    "ERROR",
  ] satisfies OrderTransition[]),
  status: z.enum(["PENDING", "CONFIRMED", "SHIPPED"] satisfies OrderStatus[]),
  reason: z.string().trim().max(300).optional(),
});

export async function updateOrderStateAction(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  const actor = await getCurrentUserWithRole();
  if (!actor) redirect("/api/auth/signin?callbackUrl=/admin");
  if (!hasRole(actor.role, "ADMIN")) {
    return { error: "Only admins can update order state." };
  }

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order." };

  const order = await prisma.passportOrder.findUnique({
    where: { id: orderId },
    select: { id: true, currentState: true, status: true },
  });
  if (!order) return { error: "Order not found." };

  const parsed = stateSchema.safeParse({
    currentState: formData.get("currentState"),
    status: formData.get("status"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  if (parsed.data.currentState === order.currentState && parsed.data.status === order.status) {
    return { error: "Nothing to update — the order is already in this state." };
  }

  const previousState = order.currentState;

  try {
    await updateOrderState({
      orderId,
      newState: parsed.data.currentState,
      status: parsed.data.status,
      actor: actor.id,
      actorType: "ADMIN",
      description: parsed.data.reason
        ? `State changed from ${previousState} to ${parsed.data.currentState}: ${parsed.data.reason}`
        : `State changed from ${previousState} to ${parsed.data.currentState}`,
    });
  } catch (e) {
    if (e instanceof InvalidOrderTransitionError) {
      return { error: `Can't move an order from ${previousState.replaceAll("_", " ").toLowerCase()} to ${parsed.data.currentState.replaceAll("_", " ").toLowerCase()}.` };
    }
    return { error: "Couldn't update the order state. Try again." };
  }

  await auditLog({
    entityType: "PassportOrder",
    entityId: orderId,
    action: "ORDER_STATE_CHANGED",
    actor: actor.id,
    actorType: "ADMIN",
    beforeValue: { currentState: previousState, status: order.status },
    afterValue: { currentState: parsed.data.currentState, status: parsed.data.status },
    description: `Order state updated by ${actor.name ?? actor.email}`,
  });

  // Notify the recipient when a passport is actually on its way / arrives.
  if (parsed.data.currentState === "SHIPPING") {
    await deliverOrderEmail(orderId, "shipped");
  } else if (parsed.data.currentState === "DELIVERED") {
    await deliverOrderEmail(orderId, "delivered");
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return {
    ok: `State updated to ${parsed.data.currentState.replaceAll("_", " ").toLowerCase()}.`,
  };
}

const createShipmentSchema = z.object({
  carrier: z.string().trim().min(2, "Enter a carrier").max(60, "Carrier is too long"),
  trackingNumber: z.string().trim().min(3, "Enter a tracking number").max(120, "Tracking number is too long"),
  note: z.string().trim().max(300).optional(),
});

/**
 * Record a shipment on an order and, when the order isn't already moving,
 * advance it to SHIPPING (which sends the "shipped" email). This is the only
 * way to attach a real tracking number to a passport order.
 */
export async function createShipmentAction(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  const actor = await getCurrentUserWithRole();
  if (!actor) redirect("/api/auth/signin?callbackUrl=/admin");
  if (!hasRole(actor.role, "ADMIN")) {
    return { error: "Only admins can add shipments." };
  }

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order." };

  const order = await prisma.passportOrder.findUnique({
    where: { id: orderId },
    select: { id: true, currentState: true, recipientEmail: true, recipientToken: true },
  });
  if (!order) return { error: "Order not found." };

  const parsed = createShipmentSchema.safeParse({
    carrier: formData.get("carrier"),
    trackingNumber: formData.get("trackingNumber"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid shipment details." };
  }

  const shipment = await prisma.shipment.create({
    data: {
      orderId,
      carrier: parsed.data.carrier,
      trackingNumber: parsed.data.trackingNumber,
      status: "label_created",
      recipientEmail: order.recipientEmail,
      note: parsed.data.note ?? null,
      shippedAt: new Date(),
    },
  });

  await prisma.orderEvent.create({
    data: {
      orderId,
      eventType: "SHIPMENT_CREATED",
      status: order.currentState === "SHIPPING" ? "SHIPPED" : "PENDING",
      previousState: order.currentState,
      newState: order.currentState,
      actor: actor.id,
      actorType: "ADMIN",
      description: `Shipment added (${parsed.data.carrier} ${parsed.data.trackingNumber})`,
    },
  });

  await auditLog({
    entityType: "PassportOrder",
    entityId: orderId,
    action: "SHIPMENT_CREATED",
    actor: actor.id,
    actorType: "ADMIN",
    afterValue: { shipmentId: shipment.id, carrier: parsed.data.carrier },
    description: `Shipment added to order by ${actor.name ?? actor.email}`,
  });

  // Advance to SHIPPING (which sends the shipped email) unless it already is.
  let advancedToShipping = false;
  if (order.currentState !== "SHIPPING" && order.currentState !== "DELIVERED") {
    try {
      await updateOrderState({
        orderId,
        newState: "SHIPPING",
        status: "SHIPPED",
        actor: actor.id,
        actorType: "ADMIN",
        description: `Shipped via ${parsed.data.carrier}`,
      });
      advancedToShipping = true;
    } catch {
      // Order may already be past SHIPPING in a state machine sense; the
      // shipment + tracking are still recorded, so don't fail the request.
    }
  }
  await deliverOrderEmail(orderId, "shipped");

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/track/${order.recipientToken ?? ""}`);
  revalidatePath("/admin/orders");

  return {
    ok: advancedToShipping
      ? "Shipment added and order moved to shipping."
      : "Shipment added.",
  };
}
