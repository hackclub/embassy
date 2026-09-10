"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

const TABS = [
  { href: "/me", label: "Home" },
  { href: "/me/projects", label: "Projects" },
  { href: "/me/shop", label: "Shop" },
];

export default function MeTabs() {
  const pathname = usePathname();
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const activeHref = TABS.find((tab) =>
    tab.href === "/me" ? pathname === "/me" : pathname.startsWith(tab.href),
  )?.href;

  useLayoutEffect(() => {
    const measure = () => {
      const el = activeHref ? tabRefs.current[activeHref] : null;
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeHref]);

  return (
    <nav aria-label="Your account" className="mb-6">
      <ul
        className="relative flex gap-1 overflow-x-auto border-b-2 border-govuk-grey-2"
        role="list"
      >
        {TABS.map((tab) => {
          const active = tab.href === activeHref;
          return (
            <li key={tab.href}>
              <Link
                ref={(node) => {
                  tabRefs.current[tab.href] = node;
                }}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block whitespace-nowrap rounded-t-md px-4 py-2 text-sm no-underline transition-colors ${
                  active
                    ? "bg-white font-bold text-govuk-black"
                    : "font-semibold text-govuk-blue hover:bg-govuk-grey-4/10 hover:text-govuk-blue-hover"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-1 bg-govuk-blue transition-[transform,width] duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
          }}
        />
      </ul>
    </nav>
  );
}
