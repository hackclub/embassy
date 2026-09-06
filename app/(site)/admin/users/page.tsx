import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import AdminUsersClient from "./UsersClient";

export default async function AdminUsersPage() {
  const user = await getCurrentUserWithRole();

  if (!user || !hasRole(user.role, "ADMIN")) {
    redirect("/admin");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      slackId: true,
      hcaId: true,
      createdAt: true,
      _count: { select: { createdOrders: true, orgs: true } },
    },
  });

  const userRows = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return <AdminUsersClient initialUsers={userRows} />;
}