import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import AdminActivityClient from "./ActivityClient";

export default async function AdminActivityPage() {
  const user = await getCurrentUserWithRole();

  if (!user || !hasRole(user.role, "ADMIN")) {
    redirect("/admin");
  }

  const events = await prisma.orderEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      order: { select: { id: true, recipientName: true, org: { select: { name: true } }, yswsId: true } },
    },
  });

  const eventRows = events.map((e: typeof events[number]) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    eventType: e.eventType,
    orderId: e.orderId,
    order: {
      org: e.order.org ? { name: e.order.org.name } : null,
      recipientName: e.order.recipientName,
      yswsId: e.order.yswsId,
    },
    newState: e.newState,
    actor: e.actor,
    actorType: e.actorType,
    description: e.description,
  }));

  return <AdminActivityClient initialEvents={eventRows} />;
}