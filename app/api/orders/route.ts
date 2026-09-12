import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { resolveAPIKeyContext, verifyYSWSAccess } from "@/lib/ysws-context";
import { rateLimit, RATE_LIMITS, createRateLimitResponse } from "@/lib/rate-limit";
import { deliverOrderEmail } from "@/lib/services/email.service";

export const runtime = "nodejs";

const createOrderSchema = z.object({
  recipientEmail: z.string().email("Enter a valid recipient email"),
  recipientName: z.string().min(2, "Enter the recipient's name").max(80, "Name is too long"),
  note: z.string().max(300).optional(),
});

const ORDER_FIELDS = {
  id: true,
  orgId: true,
  yswsId: true,
  totalQuantity: true,
  currentState: true,
  status: true,
  note: true,
  recipientName: true,
  recipientEmail: true,
  recipientToken: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function POST(req: Request) {
  const rl = await rateLimit(req, RATE_LIMITS.orders);
  if (!rl.allowed) {
    return createRateLimitResponse(rl);
  }

  const context = await resolveAPIKeyContext(req, "orders:write");
  if (!context) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key or sign in as an organizer." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  if (context.actorType === "api") {
    if (!context.yswsId) {
      return NextResponse.json(
        { error: "No YSWS associated with this API key" },
        { status: 400 }
      );
    }
  } else {
    if (!context.yswsId) {
      return NextResponse.json(
        { error: "No active YSWS found for your organization" },
        { status: 400 }
      );
    }
    const access = await verifyYSWSAccess(context.actorId, context.yswsId);
    if (!access) {
      return NextResponse.json(
        { error: "You are not authorized for this YSWS" },
        { status: 403 }
      );
    }
  }

  const email = parsed.data.recipientEmail.toLowerCase().trim();
  const linkedUser = await prisma.user.findUnique({ where: { email } });

  const recipientToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  const order = await prisma.passportOrder.create({
    data: {
      orgId: context.orgId,
      yswsId: context.yswsId,
      totalQuantity: 1,
      currentState: "AWAITING_RECIPIENT_DETAILS",
      status: "PENDING",
      note: parsed.data.note ?? null,
      createdFrom: context.actorType === "api" ? "api" : "dashboard",
      recipientName: parsed.data.recipientName,
      recipientEmail: email,
      recipientToken,
      createdByUserId: linkedUser?.id ?? null,
      recipients: email ? {
        create: {
          email,
          name: parsed.data.recipientName,
          userId: linkedUser?.id ?? null,
        },
      } : undefined,
    },
    select: ORDER_FIELDS,
  });

  await deliverOrderEmail(order.id, "created");

  return NextResponse.json({ order }, { status: 201 });
}

export async function GET(req: Request) {
  // Rate limiting
  const rl = await rateLimit(req, RATE_LIMITS.orders);
  if (!rl.allowed) {
    return createRateLimitResponse(rl);
  }

  const context = await resolveAPIKeyContext(req, "orders:read");
  if (!context) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key or sign in as an organizer." },
      { status: 401 }
    );
  }

  // For API key users, the key is scoped to a specific YSWS
  if (context.actorType === "api") {
    if (!context.yswsId) {
      return NextResponse.json(
        { error: "No YSWS associated with this API key" },
        { status: 400 }
      );
    }
    const orders = await prisma.passportOrder.findMany({
      where: { yswsId: context.yswsId },
      orderBy: { createdAt: "desc" },
      select: ORDER_FIELDS,
    });
    return NextResponse.json({ orders });
  }

  // For session users, they can see all orders for their org
  // but we should filter by accessible YSWSes if they specify one
  const user = await getCurrentUserWithRole();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // If user is admin, they can see all org orders
  if (hasRole(user.role, "ADMIN")) {
    const orders = await prisma.passportOrder.findMany({
      where: { orgId: context.orgId },
      orderBy: { createdAt: "desc" },
      select: ORDER_FIELDS,
    });
    return NextResponse.json({ orders });
  }

  // For organizers, only show orders from YSWSes they have access to
  const accessibleYSWSes = await prisma.organizerYSWSMembership.findMany({
    where: { userId: user.id },
    select: { yswsId: true },
  });
  const yswsIds = accessibleYSWSes.map((m) => m.yswsId);

  const orders = await prisma.passportOrder.findMany({
    where: {
      orgId: context.orgId,
      yswsId: { in: yswsIds },
    },
    orderBy: { createdAt: "desc" },
    select: ORDER_FIELDS,
  });

  return NextResponse.json({ orders });
}