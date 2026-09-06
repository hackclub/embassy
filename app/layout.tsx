import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import home from "../content/home.json";

const zarathustra = localFont({
  variable: "--font-zarathustra",
  src: "./fonts/zarathustra.otf",
  display: "swap",
});

const inter = Inter({
  variable: "--font-gds",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: home.metaTitle,
  description: home.heroIntro,
  openGraph: {
    title: home.metaTitle,
    description: home.heroIntro,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${zarathustra.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-govuk-white text-govuk-text">
        {children}
      </body>
    </html>
  );
}
