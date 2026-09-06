import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import AdminOrdersClient from "./OrdersClient";

export default async function AdminOrdersPage() {
  const user = await getCurrentUserWithRole();

  if (!user || !hasRole(user.role, "ADMIN")) {
    redirect("/admin");
  }

  const [orders, yswses] = await Promise.all([
    prisma.passportOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: { org: { select: { name: true } }, ysws: { select: { name: true, id: true } } },
    }),
    prisma.ySWS.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const orderRows = orders.map((o: typeof orders[0]) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    ysws: o.ysws ? { id: o.ysws.id, name: o.ysws.name } : null,
  }));

  return <AdminOrdersClient initialOrders={orderRows} initialYswses={yswses} />;
}