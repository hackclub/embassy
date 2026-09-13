import Link from "next/link";
import { Metadata } from "next";
import Header from "./components/Header";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-6xl font-bold font-hc text-hc tracking-tight">
            404
          </h1>
          <h2 className="mb-4 text-2xl font-bold text-govuk-black sm:text-3xl">
            Page not found
          </h2>
          <p className="mb-8 text-lg text-govuk-grey-4 max-w-md mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="govuk-button"
            >
              Go to homepage
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
