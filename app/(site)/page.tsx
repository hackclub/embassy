import Image from "next/image";
import Link from "next/link";
import FadeIn from "@/app/components/FadeIn";
import Feedback from "@/app/components/Feedback";
import faqLinks from "@/content/faq-links.json";
import featuredItems from "@/content/featured.json";
import page from "@/content/home.json";

const SLACK_URL = "https://app.slack.com/client/E09V59WQY1E/C0BM1L56D19";
// TODO: CHANGE THE BUTTONS TO GREEN FOLLOWING GOVUK STYLE
export default function Home() {
  return (
    <div className="pb-12">
      <FadeIn className="mx-auto max-w-5xl px-5 pt-14">
        <section>
          <h1 className=" text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Apply for your <span className="font-hc text-hc">Hack Club</span> ID
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-govuk-grey-4">
            {page.heroIntro}
          </p>

          <div className="mt-8">
            <Link
              href={SLACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="govuk-button no-underline"
            >
              Start now
            </Link>
          </div>
        </section>

        <hr className="section-rule" />

        <section className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div className="md:col-span-2">
            <h2 className="text-xl font-bold">FAQs</h2>
            <p className="mt-1 text-sm text-govuk-text-muted">
              {page.faqSectionIntro}
            </p>
            <ul className="mt-4 space-y-5">
              {faqLinks.map((item) => (
                <li key={item.q}>
                  <Link
                    href="/faq"
                    className="text-base font-bold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
                  >
                    {item.q}
                  </Link>
                  <p className="mt-1 text-sm text-govuk-text-muted">
                    {item.desc}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold">Featured</h2>
            <p className="mt-1 text-sm text-govuk-text-muted">
              {page.featuredSectionIntro}
            </p>
            <div className="mt-4">
              {featuredItems.map((item) => (
                <div key={item.title} className="gem-c-image-card">
                  <div className="gem-c-image-card__image-wrapper">
                    <Image
                      src={item.img}
                      alt=""
                      width={90}
                      height={90}
                      className="gem-c-image-card__image"
                    />
                  </div>
                  <div className="gem-c-image-card__text-wrapper">
                    <h3 className="gem-c-image-card__title">
                      <Link
                        href={item.href}
                        className="text-base font-bold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
                      >
                        {item.title}
                      </Link>
                    </h3>
                    <p className="gem-c-image-card__description">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Feedback />
      </FadeIn>
    </div>
  );
}
