import { prisma } from "../prisma";
import { auditLog } from "../audit";
import { getRequestId } from "../request-id";
import { getProvider, sendEmail } from "../email/send";
import { getBaseUrl } from "../hackatime";
import { captureEmailError } from "../sentry";
import type { EventType } from "../../generated/prisma/enums";

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Emails are HTML built from user-supplied strings (names, org names).
// Escape everything before interpolation.
function esc(value: string | null | undefined): string {
  return (value ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function appBaseUrl(): string {
  return getBaseUrl();
}

export function emailFeatureEnabled(): boolean {
  return (process.env.FEATURE_EMAIL ?? "false") === "true";
}

export async function createEmailDelivery(input: {
  orderId: string;
  recipientEmail: string;
  eventType: EventType;
  status: "sent" | "failed" | "retrying" | "pending";
  attempts?: number;
  errorMessage?: string;
}) {
  return prisma.emailDelivery.create({
    data: {
      orderId: input.orderId,
      recipientEmail: input.recipientEmail,
      eventType: input.eventType,
      status: input.status,
      attempts: input.attempts ?? 0,
      errorMessage: input.errorMessage ?? null,
    },
  });
}

export async function updateEmailDeliveryStatus(
  id: string,
  status: "sent" | "failed" | "retrying" | "pending",
  errorMessage?: string
) {
  return prisma.emailDelivery.update({
    where: { id },
    data: {
      status,
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      sentAt: status === "sent" ? new Date() : undefined,
      errorMessage: errorMessage ?? null,
    },
  });
}

export async function getPendingEmails(limit = 50) {
  return prisma.emailDelivery.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function getFailedEmails(limit = 50) {
  return prisma.emailDelivery.findMany({
    where: { status: "failed", attempts: { lt: 3 } },
    orderBy: { lastAttemptAt: { sort: "asc", nulls: "first" } },
    take: limit,
  });
}

export function generateOrderCreatedEmail(order: {
  id: string;
  recipientName: string | null;
  recipientToken: string;
  yswsName: string;
  orgName: string;
}): EmailTemplate {
  const base = appBaseUrl();
  const trackingUrl = `${base}/track/${encodeURIComponent(order.recipientToken)}`;
  const recipientUrl = `${base}/recipient/${encodeURIComponent(order.recipientToken)}`;

  return {
    subject: `Your Hack Club Passport order from ${order.yswsName}`,
    html: `
      <h1>Passport Order Created</h1>
      <p>Hi ${esc(order.recipientName ?? "there")},</p>
      <p>A passport order has been created for you by <strong>${esc(order.yswsName)}</strong> (${esc(order.orgName)}).</p>
      <p>Please complete your details at: <a href="${esc(recipientUrl)}">${esc(recipientUrl)}</a></p>
      <p>Track your order at: <a href="${esc(trackingUrl)}">${esc(trackingUrl)}</a></p>
      <hr>
      <p><small>Order ID: ${esc(order.id)}</small></p>
    `,
    text: `
Passport Order Created

Hi ${order.recipientName ?? "there"},

A passport order has been created for you by ${order.yswsName} (${order.orgName}).

Please complete your details at: ${recipientUrl}

Track your order at: ${trackingUrl}

Order ID: ${order.id}
    `,
  };
}

export function generateDetailsReceivedEmail(order: {
  id: string;
  recipientName: string | null;
  recipientToken: string;
  yswsName: string;
}): EmailTemplate {
  const trackingUrl = `${appBaseUrl()}/track/${encodeURIComponent(order.recipientToken)}`;

  return {
    subject: `Passport details received - ${order.yswsName}`,
    html: `
      <h1>Details Received</h1>
      <p>Hi ${esc(order.recipientName ?? "there")},</p>
      <p>We've received your details and your passport is now being prepared.</p>
      <p>Track your order at: <a href="${esc(trackingUrl)}">${esc(trackingUrl)}</a></p>
      <hr>
      <p><small>Order ID: ${esc(order.id)}</small></p>
    `,
    text: `
Details Received

Hi ${order.recipientName ?? "there"},

We've received your details and your passport is now being prepared.

Track your order at: ${trackingUrl}

Order ID: ${order.id}
    `,
  };
}

export function generateShippedEmail(order: {
  id: string;
  recipientName: string | null;
  recipientToken: string;
  trackingNumber: string;
  carrier: string;
}): EmailTemplate {
  const trackingUrl = `${appBaseUrl()}/track/${encodeURIComponent(order.recipientToken)}`;

  return {
    subject: `Your passport has shipped!`,
    html: `
      <h1>Your Passport Has Shipped</h1>
      <p>Hi ${esc(order.recipientName ?? "there")},</p>
      <p>Your Hack Club Passport has been shipped via <strong>${esc(order.carrier)}</strong>.</p>
      <p>Tracking number: <strong>${esc(order.trackingNumber)}</strong></p>
      <p>Track your shipment at: <a href="${esc(trackingUrl)}">${esc(trackingUrl)}</a></p>
      <hr>
      <p><small>Order ID: ${esc(order.id)}</small></p>
    `,
    text: `
Your Passport Has Shipped

Hi ${order.recipientName ?? "there"},

Your Hack Club Passport has been shipped via ${order.carrier}.

Tracking number: ${order.trackingNumber}

Track your shipment at: ${trackingUrl}

Order ID: ${order.id}
    `,
  };
}

export function generateDeliveredEmail(order: {
  id: string;
  recipientName: string | null;
  recipientToken: string;
}): EmailTemplate {
  const trackingUrl = `${appBaseUrl()}/track/${encodeURIComponent(order.recipientToken)}`;

  return {
    subject: `Your passport has been delivered!`,
    html: `
      <h1>Delivered!</h1>
      <p>Hi ${esc(order.recipientName ?? "there")},</p>
      <p>Your Hack Club Passport has been delivered.</p>
      <p>View details at: <a href="${esc(trackingUrl)}">${esc(trackingUrl)}</a></p>
      <hr>
      <p><small>Order ID: ${esc(order.id)}</small></p>
    `,
    text: `
Delivered!

Hi ${order.recipientName ?? "there"},

Your Hack Club Passport has been delivered.

View details at: ${trackingUrl}

Order ID: ${order.id}
    `,
  };
}

export type OrderEmailKind = "created" | "details" | "shipped" | "delivered";

/**
 * Send (or queue) the email for an order event. The recorded delivery status
 * always reflects what actually happened — never a fake "sent".
 */
export async function deliverOrderEmail(
  orderId: string,
  kind: OrderEmailKind
): Promise<void> {
  try {
    const order = await prisma.passportOrder.findUnique({
      where: { id: orderId },
      include: {
        ysws: { select: { name: true } },
        org: { select: { name: true } },
        shipments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!order || !order.recipientEmail || !order.recipientToken) return;

    const shipment = order.shipments[0];
    const eventType: EventType =
      kind === "created"
        ? "ORDER_CREATED"
        : kind === "details"
          ? "RECIPIENT_DETAILS_SUBMITTED"
          : kind === "shipped"
            ? "SHIPMENT_CREATED"
            : "STATUS_CHANGED";

    // One shipment / one delivery notification per order: "shipped" can be
    // triggered both by adding a shipment and by a SHIPPING state change.
    if (kind === "shipped" || kind === "delivered") {
      const already = await prisma.emailDelivery.findFirst({
        where: { orderId: order.id, eventType },
        select: { id: true },
      });
      if (already) return;
    }

    if (!emailFeatureEnabled()) {
      await createEmailDelivery({
        orderId: order.id,
        recipientEmail: order.recipientEmail,
        eventType,
        status: "pending",
      });
      return;
    }

    const yswsName = order.ysws?.name ?? order.org?.name ?? "Hack Club";
    const tpl =
      kind === "created"
        ? generateOrderCreatedEmail({
            id: order.id,
            recipientName: order.recipientName,
            recipientToken: order.recipientToken,
            yswsName,
            orgName: order.org?.name ?? "",
          })
        : kind === "details"
          ? generateDetailsReceivedEmail({
              id: order.id,
              recipientName: order.recipientName,
              recipientToken: order.recipientToken,
              yswsName,
            })
          : kind === "shipped" && shipment
            ? generateShippedEmail({
                id: order.id,
                recipientName: order.recipientName,
                recipientToken: order.recipientToken,
                trackingNumber: shipment.trackingNumber ?? "n/a",
                carrier: shipment.carrier ?? "the courier",
              })
            : kind === "delivered"
              ? generateDeliveredEmail({
                  id: order.id,
                  recipientName: order.recipientName,
                  recipientToken: order.recipientToken,
                })
              : null;

    if (!tpl) return;

    await sendEmail({
      orderId: order.id,
      recipientEmail: order.recipientEmail,
      eventType,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
  } catch (e) {
    captureEmailError(e instanceof Error ? e : new Error(String(e)), {
      orderId,
      emailType: kind,
    });
  }
}

/**
 * Retry queued (pending) and failed deliveries. Intended to be run from a
 * cron job, ops task, or the admin "Email queue" button (there is no
 * in-process scheduler). Failed rows stop after 3 attempts.
 */
export async function processEmailQueue(): Promise<{ sent: number; failed: number }> {
  if (!emailFeatureEnabled()) return { sent: 0, failed: 0 };

  const [pending, failedRows] = await Promise.all([
    getPendingEmails(10),
    getFailedEmails(10),
  ]);
  const queue = [...pending, ...failedRows];
  let sent = 0;
  let failed = 0;

  for (const email of queue) {
    try {
      const order = email.orderId
        ? await prisma.passportOrder.findUnique({
            where: { id: email.orderId },
            include: {
              ysws: { select: { name: true } },
              org: { select: { name: true } },
              shipments: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          })
        : null;

      let tpl: EmailTemplate | null = null;
      if (order?.recipientToken) {
        const yswsName = order.ysws?.name ?? order.org?.name ?? "Hack Club";
        if (email.eventType === "ORDER_CREATED") {
          tpl = generateOrderCreatedEmail({
            id: order.id,
            recipientName: order.recipientName,
            recipientToken: order.recipientToken,
            yswsName,
            orgName: order.org?.name ?? "",
          });
        } else if (email.eventType === "RECIPIENT_DETAILS_SUBMITTED") {
          tpl = generateDetailsReceivedEmail({
            id: order.id,
            recipientName: order.recipientName,
            recipientToken: order.recipientToken,
            yswsName,
          });
        } else if (email.eventType === "SHIPMENT_CREATED" && order.shipments[0]) {
          const shipment = order.shipments[0];
          tpl = generateShippedEmail({
            id: order.id,
            recipientName: order.recipientName,
            recipientToken: order.recipientToken,
            trackingNumber: shipment.trackingNumber ?? "n/a",
            carrier: shipment.carrier ?? "the courier",
          });
        } else if (email.eventType === "STATUS_CHANGED") {
          tpl = generateDeliveredEmail({
            id: order.id,
            recipientName: order.recipientName,
            recipientToken: order.recipientToken,
          });
        }
      }

      if (!tpl) {
        // No order/template to render — stop churning this row forever.
        await updateEmailDeliveryStatus(email.id, "failed", "no template for event");
        failed += 1;
        continue;
      }

      try {
        await getProvider().send({
          to: email.recipientEmail,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          meta: { orderId: email.orderId ?? undefined },
        });
        await updateEmailDeliveryStatus(email.id, "sent");
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await updateEmailDeliveryStatus(email.id, "failed", message);
        failed += 1;
        await auditLog({
          entityType: "EmailDelivery",
          entityId: email.id,
          action: "EMAIL_FAILED",
          actor: "system",
          actorType: "SYSTEM",
          description: `Failed to send email: ${message}`,
          requestId: await getRequestId(),
        });
      }
    } catch (error) {
      await updateEmailDeliveryStatus(
        email.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
      failed += 1;
    }
  }

  return { sent, failed };
}
