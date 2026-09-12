import Image from "next/image";
import Link from "next/link";

const LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: "About Embassy", href: "/" },
  { label: "How it works", href: "/how-it-works" },
  {
    label: "Slack",
    href: "https://app.slack.com/client/E09V59WQY1E/C0BM1L56D19",
    external: true,
  },
  { label: "GitHub", href: "https://github.com/hackclub/embassy", external: true },
];

export default function Footer() {
  return (
    <footer className="bg-govuk-white">
      <div className="mx-auto max-w-5xl px-5 pt-14 pb-16 text-center">
        <ul
          role="list"
          className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-sm text-govuk-text-muted"
        >
          {LINKS.map((link, i) => (
            <li key={link.label} className="flex items-center gap-x-1">
              {i > 0 && (
                <span aria-hidden="true" className="text-govuk-grey-2">
                  ·
                </span>
              )}
              {link.external ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 transition-colors hover:text-govuk-black hover:underline"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  href={link.href}
                  className="px-2 py-1 transition-colors hover:text-govuk-black hover:underline"
                >
                  {link.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-12 flex items-center justify-center gap-8">
          <a
            href="https://hackclub.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Hack Club"
            className="opacity-60 transition-opacity hover:opacity-90"
          >
            {/* Remote SVG: next/image skips SVG optimization unless
                dangerouslyAllowSVG is enabled, so keep a plain <img>. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://assets.hackclub.com/flag-standalone-bw.svg"
              alt="Hack Club"
              width={64}
              height={22}
              className="block"
            />
          </a>
          <a
            href="https://app.slack.com/client/E09V59WQY1E/C0BM1L56D19"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Hack Club Slack"
            className="opacity-60 transition-opacity hover:opacity-90"
          >
            <Image
              src="/slack.svg"
              alt="Slack"
              width={20}
              height={20}
              className="block grayscale"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
