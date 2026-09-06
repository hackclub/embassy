import Link from "next/link";
import Breadcrumb from "@/app/components/Breadcrumb";
import FadeIn from "@/app/components/FadeIn";
import Feedback from "@/app/components/Feedback";
import faqs from "@/content/faq.json";
import page from "@/content/faq-page.json";

export default function FAQPage() {
  return (
    <div className="pb-12">
      <FadeIn className="mx-auto max-w-5xl px-5 pt-10">
        <Breadcrumb
          items={[
            { label: "whoami", href: "/" },
            { label: "FAQ" },
          ]}
        />

        <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Frequently asked questions
        </h1>
        <p className="mb-8 text-lg text-govuk-grey-4">
          {page.faqIntro}
        </p>

        <div>
          {faqs.map((faq, i) => (
            <details key={i} className="group">
              <summary className="faq-summary text-lg font-bold text-govuk-blue underline underline-offset-4">
                {faq.q}
                <span className="faq-indicator">+</span>
              </summary>
              <p className="faq-answer max-w-2xl border-l-4 border-solid border-govuk-grey-2 px-6 pb-2 pt-1 text-base leading-relaxed text-govuk-grey-4">
                {faq.a}
              </p>
            </details>
          ))}
        </div>

        <hr className="section-rule" />

        <section className="govuk-panel">
          <h2 className="text-2xl font-bold">{page.faqCtaTitle}</h2>
          <p className="mx-auto mt-3 max-w-md text-base text-white/80">
            {page.faqCtaText}
          </p>
          <div className="mt-6">
            <Link
              href="https://app.slack.com/client/E09V59WQY1E/C0BM1L56D19"
              target="_blank"
              rel="noopener noreferrer"
              className="start-now start-now--on-dark no-underline"
            >
              Ask on Slack
            </Link>
          </div>
        </section>

        <Feedback />
      </FadeIn>
    </div>
  );
}
