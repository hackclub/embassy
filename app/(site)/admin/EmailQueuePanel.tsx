"use client";

import { useActionState } from "react";
import { processEmailQueueAction } from "@/app/actions/admin";

export default function EmailQueuePanel() {
  const [state, formAction, pending] = useActionState(processEmailQueueAction, undefined);

  return (
    <section className="border-2 border-govuk-black bg-govuk-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Email queue</h2>
          <p className="text-sm text-govuk-grey-4">
            Retry pending and failed delivery attempts (up to 3 per message).
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="govuk-button govuk-button--secondary"
          >
            {pending ? "Running…" : "Run queue now"}
          </button>
        </form>
      </div>
      {state?.error && (
        <p role="alert" className="mt-2 border-l-4 border-hc-red px-3 py-1.5 font-semibold text-hc-red">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mt-2 border-l-4 border-govuk-green px-3 py-1.5 font-semibold">
          {state.ok}
        </p>
      )}
    </section>
  );
}
