import Header from "../components/Header";
import Footer from "../components/Footer";
import SiteHeaderGate from "../components/SiteHeaderGate";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <a
        href="#main-content"
        className="govuk-skip-link bg-govuk-black px-4 py-2 text-sm font-bold text-govuk-white no-underline focus:static focus:w-auto focus:overflow-visible"
      >
        Skip to main content
      </a>
      <SiteHeaderGate>
        <Header />
      </SiteHeaderGate>
      <main id="main-content" className="flex-1 scroll-mt-14">
        {children}
      </main>
      <Footer />
    </>
  );
}
