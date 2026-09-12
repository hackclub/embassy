import Breadcrumb from "@/app/components/Breadcrumb";
import FadeIn from "@/app/components/FadeIn";
import Feedback from "@/app/components/Feedback";
import steps from "@/content/steps.json";
import page from "@/content/how-it-works-page.json";

export default function HowItWorksPage() {
  return (
    <div className="pb-12">
      <FadeIn className="mx-auto max-w-5xl px-5 pt-10">
        <Breadcrumb
          items={[{ label: "Embassy", href: "/" }, { label: "How it works" }]}
        />

        <h1 className="mb-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          How to get your <span className="font-hc text-hc">hack club</span> ID
        </h1>
        <p className="mb-4 max-w-2xl text-lg leading-relaxed text-govuk-grey-4">
          {page.heroIntro}
        </p>

        <div className="tl mt-10">
          {steps.map((step) => (
            <div key={step.no} className="tl-step">
              <span className="tl-dot" aria-hidden />
              <div className="flex items-start gap-4">
                <span className="font-hc text-3xl leading-none text-hc">
                  {String(step.no).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <h2 className="mb-2 text-xl font-bold">{step.heading}</h2>
                  <p className="mb-3 text-base leading-relaxed text-govuk-grey-4">
                    {step.body}
                  </p>
                  <details className="group">
                    <summary className="faq-summary text-sm font-bold text-govuk-blue underline underline-offset-4">
                      More detail
                      <span className="faq-indicator text-sm">+</span>
                    </summary>
                    <p className="mt-2 max-w-2xl border-l-4 border-solid border-govuk-grey-2 px-6 pb-2 pt-1 text-base leading-relaxed text-govuk-grey-4">
                      {step.detail}
                    </p>
                  </details>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Feedback />
      </FadeIn>
    </div>
  );
}
