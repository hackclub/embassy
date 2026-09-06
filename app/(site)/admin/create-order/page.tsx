import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import IssuePassportAdminForm from "../IssuePassportAdminForm";
import Section from "@/app/components/Section";

export default async function AdminCreateOrderPage() {
  const user = await getCurrentUserWithRole();

  if (!user || !hasRole(user.role, "ADMIN")) {
    redirect("/admin");
  }

  const orgs = await prisma.org.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <Section
      title="Create passport order"
      description="Manually create a passport order for a specific recipient. Each order is for one participant."
    >
      <IssuePassportAdminForm orgs={orgs} />
    </Section>
  );
}