"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { auditLog } from "@/lib/audit";
import { updateOrderState } from "@/lib/services/order.service";
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

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return {
    ok: `State updated to ${parsed.data.currentState.replaceAll("_", " ").toLowerCase()}.`,
  };
}
