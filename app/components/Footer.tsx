import Link from "next/link";

export default function Footer() {
  return (
    <footer>
      <div className="border-t border-govuk-border bg-govuk-grey-1">
        <div className="mx-auto max-w-5xl px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-hc text-xl text-hc">Hack Club</p>
              <p className="mt-0.5 text-xs text-govuk-text-muted">
                A Hack Club YSWS.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://hackclub.com"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-60"
              >
                <img
                  src="https://assets.hackclub.com/flag-standalone-bw.svg"
                  alt="Hack Club"
                  width={80}
                  height={28}
                  className="block"
                />
              </a>
              <a
                href="https://app.slack.com/client/E09V59WQY1E/C0BM1L56D19"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-60"
              >
                <img
                  src="/slack.svg"
                  alt="Slack"
                  width="32"
                  height="32"
                  className="block grayscale"
                />
              </a>
            </div>
          </div>
          <div className="mt-3 border-t border-govuk-border pt-2">
            <p className="text-xs text-govuk-text-muted mb-0">
              Made by Hack Club.{" "}
              <Link href="/how-it-works" className="text-govuk-blue underline">
                How it works
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
