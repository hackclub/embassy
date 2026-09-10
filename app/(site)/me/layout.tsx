import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/org";
import MeTabs from "./MeTabs";

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserWithRole();
  if (!user) redirect("/api/auth/signin?callbackUrl=/me");

  return (
    <div className="font-runde mx-auto max-w-6xl px-6 py-8">
      <MeTabs />
      {children}
    </div>
  );
}
