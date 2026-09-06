"use client";

import { useState } from "react";
import { XIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
};

export default function MobileSidebar({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
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
    <>
      {/* Mobile hamburger button - fixed bottom right on mobile */}
      <button
        className="lg:hidden fixed bottom-6 right-6 z-50 bg-hc-red text-white p-3 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <MenuIcon className="w-6 h-6" />
      </button>

      {/* Sheet overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-80 max-w-full bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-govuk-grey-2">
              <h2 className="text-lg font-bold">Administration</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-2 text-govuk-grey-4 hover:text-govuk-black"
                aria-label="Close navigation"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            <nav className="p-4 overflow-y-auto h-[calc(100%-80px)]">
              <ul className="space-y-0.5" role="list">
                {items.map((item) => {
                  const active = isActive(item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
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
          </div>
        </div>
      )}
    </>
  );
}