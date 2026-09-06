import { getCurrentUserWithRole, hasRole } from "@/lib/org";
import { redirect } from "next/navigation";
import AddOrganizerForm from "../AddOrganizerForm";
import Section from "@/app/components/Section";

export default async function AdminRegisterOrganizerPage() {
  const user = await getCurrentUserWithRole();

  if (!user || !hasRole(user.role, "ADMIN")) {
    redirect("/admin");
  }

  return (
    <Section
      title="Register an organizer"
      description="Promote someone to organizer and register their YSWS org so they can order passports. They must have signed in once."
    >
      <AddOrganizerForm />
    </Section>
  );
}