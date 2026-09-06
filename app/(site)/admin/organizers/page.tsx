import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import AdminOrganizersClient from "./OrganizersClient";

export default async function AdminOrganizersPage() {
  const user = await getCurrentUserWithRole();

  if (!user || !hasRole(user.role, "ADMIN")) {
    redirect("/admin");
  }

  const members = await prisma.orgMember.findMany({
    orderBy: { org: { name: "asc" } },
    include: {
      org: { select: { name: true, id: true } },
      user: { select: { name: true, email: true, role: true, id: true } },
    },
  });

  return <AdminOrganizersClient initialOrganizers={members} />;
}