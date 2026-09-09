import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import ShopAdminClient from "./ShopAdminClient";

export default async function AdminShopPage() {
  const user = await getCurrentUserWithRole();
  if (!user || !hasRole(user.role, "ADMIN")) redirect("/admin");

  const [items, orders] = await Promise.all([
    prisma.shopItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.shopOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        item: { select: { name: true, price: true } },
      },
    }),
  ]);

  return (
    <ShopAdminClient
      items={items.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      }))}
      orders={orders.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      }))}
    />
  );
}