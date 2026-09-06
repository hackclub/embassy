"use client";

import { ReactNode } from "react";
import Link from "next/link";

interface RecipientLayoutProps {
  children: ReactNode;
  order: { ysws?: { name: string } | null; org: { name: string } };
  token: string;
}

export default function RecipientLayout({ children, order, token }: RecipientLayoutProps) {
  const yswsName = order.ysws?.name ?? order.org.name;

  return (
    <div className="min-h-screen bg-govuk-white">
      <header className="bg-hc-blue text-white py-6">
        <div className="mx-auto max-w-2xl px-4">
          <h1 className="text-2xl font-bold">Hack Club Passport</h1>
          <p className="mt-1 text-white/80 text-sm">{yswsName}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="bg-white border-2 border-govuk-black rounded-lg p-6 md:p-8">
          {children}
        </div>
      </main>

      <footer className="bg-govuk-grey-1 border-t-2 border-govuk-grey-2 py-6 mt-8">
        <div className="mx-auto max-w-2xl px-4 text-center text-sm text-govuk-grey-4">
          <p>Questions? Contact <a href="mailto:passports@hackclub.com" className="underline hover:text-hc-red">passports@hackclub.com</a></p>
          <p className="mt-1"><Link href="/" className="underline hover:text-hc-red">Back to whoami</Link></p>
        </div>
      </footer>
    </div>
  );
}