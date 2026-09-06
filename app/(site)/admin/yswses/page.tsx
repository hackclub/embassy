import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import AdminYSWSesClient from "./YSWSesClient";

export default async function AdminYSWSesPage() {
  const user = await getCurrentUserWithRole();

  if (!user || !hasRole(user.role, "ADMIN")) {
    redirect("/admin");
  }

  const yswses = await prisma.ySWS.findMany({
    orderBy: { name: "asc" },
    include: {
      org: { select: { name: true, id: true } },
      _count: { select: { orders: true, organizerMemberships: true } },
    },
  });

  const yswsRows = yswses.map((y) => ({
    ...y,
    org: y.org ? { id: y.org.id, name: y.org.name } : null,
  }));

  return <AdminYSWSesClient initialYSWSes={yswsRows} />;
}