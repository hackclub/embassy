"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";

const navItems: {
  href: string;
  label: string;
  external?: boolean;
  mailto?: boolean;
  cardTitle?: string;
  cardLinks?: { text: string; url: string }[];
}[] = [
  {
    href: "/how-it-works",
    label: "How it works",
    cardTitle: "How it works",
    cardLinks: [
      { text: "What's Hackatime?", url: "https://hackatime.hackclub.com" },
      { text: "How will the passport look?", url: "https://hackclub.com" },
      { text: "What's the usecase?", url: "https://hackclub.com" },
    ],
  },
  {
    href: "mailto:passports@hackclub.com",
    label: "For organizers",
    mailto: true,
    cardTitle: "For organizers",
    cardLinks: [],
  },
  {
    href: "https://whoami.fillout.com/t/d7HP8yRWyxus",
    label: "RSVP",
    external: true,
  },
];

export default function NavHoverCard() {
  const [visibleIndex, setVisibleIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText("passports@hackclub.com");
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  function showCard(index: number) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisibleIndex(index);
  }

  function scheduleHide() {
    hideTimer.current = setTimeout(() => {
      setVisibleIndex(null);
    }, 120);
  }

  function cancelHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  return (
    <nav aria-label="Primary" className="relative z-40">
      <ul className="flex items-center gap-1 p-1.5 text-sm font-semibold sm:gap-2">
        {navItems.map((item, i) => {
          const hasCard = !item.external && (item.cardTitle || item.mailto);
          const isVisible = visibleIndex === i;

          return (
            <li
              key={item.href}
              ref={hasCard ? (el) => { itemRefs.current[i] = el; } : undefined}
              className={hasCard ? "relative" : ""}
            >
              {item.external ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full px-2.5 py-1.5 no-underline text-white transition-colors hover:bg-white/25 sm:px-3"
                >
                  {item.label}
                </a>
              ) : item.mailto ? (
                <a
                  href={item.href}
                  className="rounded-full px-2.5 py-1.5 no-underline text-white transition-colors hover:bg-white/25 sm:px-3"
                  onMouseEnter={() => showCard(i)}
                  onMouseLeave={scheduleHide}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  href={item.href}
                  className="rounded-full px-2.5 py-1.5 no-underline text-white transition-colors hover:bg-white/25 sm:px-3"
                  onMouseEnter={() => showCard(i)}
                  onMouseLeave={scheduleHide}
                >
                  {item.label}
                </Link>
              )}

{hasCard && (
                <div
                  className={`absolute top-full left-1/2 z-[100] mt-2 w-[min(340px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg shadow-xl nav-card-stripes transition-all duration-200 ease-out ${
                    isVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 -translate-y-1 pointer-events-none"
                  }`}
                  style={{ border: "2px solid #ff902f" }}
                  onMouseEnter={cancelHide}
                  onMouseLeave={scheduleHide}
                >
                  <div className="bg-white px-6 py-5">
                    <p className="text-lg font-bold text-govuk-black">
                      {item.cardTitle ?? ""}
                    </p>
                    {item.mailto ? (
                      <p className="mt-1 text-sm leading-relaxed text-govuk-grey-4">
                        Interested in including PASSPORT/ID in your YSWS shop? Reach out
                        to the email below.
                      </p>
                    ) : null}
                    <ul className="mt-2 space-y-1">
                      {(item.cardLinks ?? []).map((link) => (
                        <li key={link.text}>
                          <a
                            href={link.url}
                            {...(link.url.startsWith("mailto:")
                              ? {}
                              : { target: "_blank", rel: "noopener noreferrer" })}
                            className="text-sm text-govuk-blue underline underline-offset-2 transition-colors hover:text-govuk-blue-hover"
                          >
                            {link.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                    {item.mailto ? (
                      <div className="mt-4 flex items-center gap-2 border-t border-govuk-grey-2 pt-3">
                        <a
                          href="mailto:passports@hackclub.com"
                          className="text-sm font-semibold text-govuk-blue underline underline-offset-2 transition-colors hover:text-govuk-blue-hover"
                        >
                          passports@hackclub.com
                        </a>
                        <button
                          type="button"
                          onClick={copyEmail}
                          className="ml-auto rounded border border-govuk-black bg-govuk-white px-2 py-1 text-xs font-semibold text-govuk-black transition-colors hover:bg-govuk-grey-1"
                        >
                          {copied ? "Copied!" : "Copy email"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}