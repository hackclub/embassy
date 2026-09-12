"use client";

import { useState } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div
      className="govuk-cookie-banner"
      role="region"
      aria-label="Cookies on Embassy"
    >
      <div className="mx-auto max-w-5xl px-5 py-6">
        <h2 className="text-lg font-bold">Cookies on Embassy</h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-govuk-black">
          We use some essential cookies to make this service work.
        </p>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-govuk-black">
          We&apos;d also like to use analytics cookies so we can understand how
          you use this service and make improvements.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => setVisible(false)}
            className="govuk-button"
          >
            Accept analytics cookies
          </button>
          <button
            onClick={() => setVisible(false)}
            className="govuk-button govuk-button--secondary"
          >
            Reject analytics cookies
          </button>
        </div>
      </div>
    </div>
  );
}
