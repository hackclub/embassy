import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/org";
import AdminOverviewClient from "./AdminOverviewClient";

export default async function AdminPage() {
  await getCurrentUserWithRole();

  const [
    orgCount,
    orderCount,
    organizerCount,
    userCount,
    recentOrders,
    recentEvents,
  ] = await Promise.all([
    prisma.org.count(),
    prisma.passportOrder.count(),
    prisma.user.count({ where: { role: { in: ["ORGANIZER", "ADMIN"] } } }),
    prisma.user.count(),
    prisma.passportOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { org: { select: { name: true } }, ysws: { select: { name: true } } },
    }),
    prisma.orderEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { order: { select: { id: true, recipientName: true, org: { select: { name: true } } } } },
    }),
  ]);

  const recentOrdersRows = recentOrders.map((o: typeof recentOrders[0]) => ({
    id: o.id,
    recipientName: o.recipientName,
    org: { name: o.org.name },
    ysws: o.ysws ? { name: o.ysws.name } : null,
    currentState: o.currentState,
    createdAt: o.createdAt.toISOString(),
  }));

  const recentEventsRows = recentEvents.map((e: typeof recentEvents[0]) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    eventType: e.eventType,
    orderId: e.orderId,
    order: {
      org: e.order.org ? { name: e.order.org.name } : null,
      recipientName: e.order.recipientName,
    },
  }));

  return (
    <AdminOverviewClient
      stats={{ orgCount, orderCount, organizerCount, userCount }}
      recentOrders={recentOrdersRows}
      recentEvents={recentEventsRows}
    />
  );
}