import { prisma } from "@/lib/prisma";
import type { EventType } from "@/generated/prisma/client";
import logger from "@/lib/logger";

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  meta?: Record<string, unknown>;
}

export interface EmailProvider {
  readonly name: string;
  send(opts: EmailSendOptions): Promise<{ id: string }>;
}

export function getProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? "mailpit";
  switch (provider) {
    case "mailpit":
      return { name: "mailpit", send: mailpitSend };
    case "loops":
      return { name: "loops", send: loopsSend };
    default:
      throw new Error(`Unknown EMAIL_PROVIDER: ${provider}`);
  }
}

async function mailpitSend(opts: EmailSendOptions): Promise<{ id: string }> {
  const { sendMailpit } = await import("./providers/mailpit");
  return sendMailpit(opts);
}

async function loopsSend(opts: EmailSendOptions): Promise<{ id: string }> {
  const { sendLoops } = await import("./providers/loops");
  return sendLoops(opts);
}

export async function sendEmail(opts: {
  orderId?: string;
  recipientEmail: string;
  eventType: EventType;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; deliveryId?: string; error?: string }> {
  try {
    await getProvider().send({
      to: opts.recipientEmail,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      meta: { orderId: opts.orderId },
    });
    const delivery = await prisma.emailDelivery.create({
      data: {
        orderId: opts.orderId,
        recipientEmail: opts.recipientEmail,
        eventType: opts.eventType,
        status: "sent",
        sentAt: new Date(),
        attempts: 1,
      },
    });
    return { ok: true, deliveryId: delivery.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error({ err: message, eventType: opts.eventType }, "email_send_failed");
    try {
      await prisma.emailDelivery.create({
        data: {
          orderId: opts.orderId,
          recipientEmail: opts.recipientEmail,
          eventType: opts.eventType,
          status: "failed",
          attempts: 1,
          lastAttemptAt: new Date(),
          errorMessage: message.slice(0, 500),
        },
      });
    } catch {
      // DB itself down — nothing more we can do
    }
    return { ok: false, error: message };
  }
}
