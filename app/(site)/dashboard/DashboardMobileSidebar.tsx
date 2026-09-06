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

type DashboardMobileSidebarProps = {
  activeYSWS: { orgName: string; yswsName: string; yswsId: string };
  context: { role: string; accessibleYSWSes: Array<{ yswsId: string; yswsName: string }> };
  totalOrdered: number;
};

export default function DashboardMobileSidebar({ 
  activeYSWS,
  context,
  totalOrdered
}: DashboardMobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";

  const items: NavItem[] = [
    { href: "/dashboard", label: "Overview", match: (p) => p === "/dashboard" },
    { href: "/dashboard?view=orders", label: "Orders" },
    { href: "/dashboard?view=api", label: "API integration" },
  ];

  const isActive = (item: NavItem) =>
    item.match ? item.match(pathname) : pathname.startsWith(item.href);

  return (
    <>
      {/* Mobile hamburger button - fixed bottom right on mobile */}
      <button
        className="lg:hidden fixed bottom-6 right-6 z-50 bg-hc-blue text-white p-3 rounded-full shadow-lg"
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
              <h2 className="text-lg font-bold">{activeYSWS.orgName}</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-2 text-govuk-grey-4 hover:text-govuk-black"
                aria-label="Close navigation"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            <nav className="p-4 overflow-y-auto h-[calc(100%-80px)]">
              <div className="mb-4 p-4 bg-govuk-grey-1 rounded">
                <p className="text-sm text-govuk-grey-4">YSWS: <strong>{activeYSWS.yswsName}</strong></p>
                <p className="text-sm text-govuk-grey-4">Role: <strong>{totalOrdered > 0 ? ` · Total orders: ${totalOrdered}` : ""}</strong></p>
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
              {context.accessibleYSWSes.length > 1 && (
                <div className="mt-6 pt-4 border-t border-govuk-grey-2">
                  <h3 className="text-sm font-bold text-govuk-grey-4 mb-3">Switch YSWS</h3>
                  <ul className="space-y-2">
                    {context.accessibleYSWSes.map((y) => (
                      <li key={y.yswsId}>
                        <Link
                          href={`/dashboard?ysws=${y.yswsId}`}
                          onClick={() => setOpen(false)}
                          className={`block px-3 py-2 text-sm rounded transition-colors ${
                            y.yswsId === activeYSWS.yswsId
                              ? "bg-govuk-blue text-white font-semibold"
                              : "text-govuk-grey-4 hover:bg-govuk-grey-1"
                          }`}
                        >
                          {y.yswsName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}