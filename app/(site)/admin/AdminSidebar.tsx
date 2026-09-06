"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
};

export default function AdminSidebar({ role }: { role: string }) {
  const pathname = usePathname() ?? "";

  const items: NavItem[] = [
    { href: "/admin", label: "Overview", match: (p) => p === "/admin" },
    { href: "/admin/orders", label: "Passport orders" },
    { href: "/admin/yswses", label: "YSWSes" },
    { href: "/admin/organizers", label: "Organizers" },
    { href: "/admin/users", label: "Users & roles" },
    { href: "/admin/activity", label: "Activity" },
  ];

  const isActive = (item: NavItem) =>
    item.match ? item.match(pathname) : pathname.startsWith(item.href);

  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-[var(--admin-sidebar-sticky-offset)]" aria-label="Admin navigation">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-govuk-grey-4">
          Administration
        </h2>
        <ul className="space-y-0.5" role="list">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block border-l-4 px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-govuk-blue bg-transparent font-semibold text-govuk-black"
                      : "border-transparent text-govuk-grey-4 hover:border-govuk-grey-2 hover:text-govuk-black"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
