import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminRolesPage() {
  const user = await getCurrentUserWithRole();

  if (!user || !hasRole(user.role, "SUPERADMIN")) {
    redirect("/admin");
  }

  return (
    <p className="text-govuk-grey-4">
      User roles are now managed on the{" "}
      <Link href="/admin/users" className="govuk-link">
        Users & roles
      </Link>
      {" page."}
    </p>
  );
}
