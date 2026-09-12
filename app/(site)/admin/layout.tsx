import Link from "next/link";
import { getCurrentUserWithRole, hasRole, ROLE_LABEL } from "@/lib/org";
import { isAuthBypassEnabled } from "@/lib/bypass";
import AdminSidebar from "./AdminSidebar";
import MobileSidebar from "./MobileSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserWithRole();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-1 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Admin
        </h1>
        <p className="mb-4 max-w-2xl text-lg leading-relaxed text-govuk-grey-4">
          Sign in with Hack Club to manage organizers and YSWSes.
        </p>
        <Link
          href="/api/auth/signin?callbackUrl=/admin"
          className="govuk-button"
        >
          Sign in with Hack Club
        </Link>
      </div>
    );
  }

  if (!hasRole(user.role, "ADMIN")) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-1 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Admin
        </h1>
        <p className="mb-4 max-w-2xl text-lg leading-relaxed text-govuk-grey-4">
          You need admin access to manage organizers. Contact a superadmin.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-govuk-white">
      {isAuthBypassEnabled() && (
        <p
          role="status"
          className="bg-govuk-yellow px-6 py-2 text-center text-sm font-bold text-govuk-black"
        >
          ADMIN_BYPASS is active — authentication is disabled for testing. Never
          enable this in production.
        </p>
      )}
      <header className="border-b border-govuk-grey-2 bg-govuk-white sticky top-0 z-30">
        <div className="mx-auto max-w-full px-6 py-3">
          <nav
            className="flex items-center justify-between gap-4"
            aria-label="Global"
          >
            <Link
              href="/"
              className="font-hc text-2xl font-bold text-hc leading-none"
            >
              Embassy
            </Link>
            <div className="hidden sm:flex items-center gap-4 text-sm text-govuk-grey-4">
              <span>
                Signed in as <strong>{user.name ?? user.email}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Role: <strong>{ROLE_LABEL[user.role]}</strong>
              </span>
              <Link href="/api/auth/signout" className="govuk-link">
                Sign out
              </Link>
            </div>
            {/* Mobile: identity collapses; hamburger (fixed, below) opens full nav */}
            <div className="flex sm:hidden items-center">
              <span className="text-sm text-govuk-grey-4">
                {ROLE_LABEL[user.role]}
              </span>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile sidebar toggle (button is fixed bottom-right; desktop uses the sticky sidebar) */}
      <MobileSidebar />

      <div className="mx-auto max-w-full px-6 py-6 md:grid md:grid-cols-[260px_1fr] md:gap-6 lg:grid-cols-[260px_1fr]">
        <aside
          className="md:sticky md:top-[var(--admin-sidebar-sticky-offset)] md:self-start hidden md:block"
          aria-label="Admin navigation"
        >
          <AdminSidebar />
        </aside>
        <main className="w-full md:col-span-1 lg:col-span-1">{children}</main>
      </div>
    </div>
  );
}
