"use client";

import { usePathname } from "next/navigation";
import PassportImage from "./PassportImage";

const SLACK_CHANNEL = "https://app.slack.com/client/E09V59WQY1E/C0BM1L56D19";

export default function BetaBanner() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";

  return (
    <div
      className={
        isHome
          ? "relative mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-5 pt-4 pb-3 text-white/80 text-xs sm:text-sm mt-2"
          : "flex flex-wrap items-center gap-2 px-5 pt-4 pb-3 text-white/80 text-xs sm:text-sm mt-2 w-full"
      }
    >
      {isHome && <PassportImage />}
      <span className="inline-block rounded-md bg-white/25 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
        beta
      </span>
      <span className="hidden sm:inline">
        This is a new service, your{" "}
        <a
          href={SLACK_CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-white"
        >
          feedback
        </a>{" "}
        will help us improve it.
      </span>
    </div>
  );
}
