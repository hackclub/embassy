"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/me", label: "Home" },
  { href: "/me/projects", label: "Projects" },
  { href: "/me/journal", label: "Journal" },
  { href: "/me/shop", label: "Shop" },
];

export default function MeTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Your account" className="mb-8">
      <ul
        className="flex gap-1 overflow-x-auto border-b-2 border-govuk-grey-2"
        role="list"
      >
        {TABS.map((tab) => {
          const active =
            tab.href === "/me" ? pathname === "/me" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block whitespace-nowrap rounded-t-md border-b-4 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "border-b-govuk-blue bg-white font-bold text-govuk-black no-underline"
                    : "border-b-transparent text-govuk-blue no-underline hover:border-b-govuk-grey-2 hover:bg-govuk-grey-4/10 hover:text-govuk-blue-hover"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
