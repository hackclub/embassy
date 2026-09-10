import Link from "next/link";
import NavHoverCard from "./NavHoverCard";
import BetaBanner from "./BetaBanner";
import { getCurrentUserWithRole, hasRole } from "@/lib/org";

export default async function Header() {
  const user = await getCurrentUserWithRole();
  const isAdmin = user ? hasRole(user.role, "ADMIN") : false;
  const canUseDashboard = user ? hasRole(user.role, "ORGANIZER") : false;

  return (
    <header
      className="relative w-full bg-gradient-to-br from-hc-blue to-[#01bbff] rounded-t-2xl shadow-lg min-h-[var(--header-height)]"
      style={{
        borderTopLeftRadius: "0.75rem",
        borderTopRightRadius: "0.75rem",
      }}
    >
      {/* Decorative background layer - geometric pattern covering whole header */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          overflow: "clip",
          borderTopLeftRadius: "0.75rem",
          borderTopRightRadius: "0.75rem",
        }}
      >
        <div
          className="absolute -inset-30"
          style={{
            backgroundImage: `
              linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.12) 75%),
              linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.12) 75%)
            `,
            backgroundSize: "44px 44px, 44px 44px",
            backgroundPosition: "0 0, 22px 22px",
            transform: "rotate(14.59deg)",
          }}
        />
      </div>

      {/* Interactive navbar layer - escapes header overflow */}
      <div className="relative z-30">
        {/* Navbar */}
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 px-5 py-2 text-white">
          <div className="flex items-center gap-1">
            {user && (
              <Link
                href="/me"
                className="rounded-full px-2.5 py-1.5 text-sm font-semibold no-underline text-white transition-colors hover:bg-white/25 sm:px-3"
              >
                Me
              </Link>
            )}

            {canUseDashboard && (
              <Link
                href="/dashboard"
                className="rounded-full px-2.5 py-1.5 text-sm font-semibold no-underline text-white transition-colors hover:bg-white/25 sm:px-3"
              >
                Dashboard
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-full px-2.5 py-1.5 text-sm font-semibold no-underline text-white transition-colors hover:bg-white/25 sm:px-3"
              >
                Admin
              </Link>
            )}

            <NavHoverCard />
          </div>
        </div>

        {/* Beta banner with responsive passport image */}
        <BetaBanner />
      </div>
    </header>
  );
}
