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
    <nav aria-label="Your account" className="mb-8 border-b border-govuk-grey-2">
      <ul className="flex flex-wrap gap-x-6 gap-y-2" role="list">
        {TABS.map((tab) => {
          const active =
            tab.href === "/me" ? pathname === "/me" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block border-b-4 px-1 py-2 ${
                  active
                    ? "border-b-govuk-blue font-bold text-govuk-black no-underline"
                    : "border-b-transparent text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
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
