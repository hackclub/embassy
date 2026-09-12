"use client";

import { useActionState } from "react";
import { syncAirtableAction } from "@/app/actions/admin";

export default function AirtableMirrorPanel({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(syncAirtableAction, undefined);

  return (
    <section className="mb-6 border-2 border-govuk-black bg-govuk-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Airtable mirror</h2>
          <p className="text-sm text-govuk-grey-4">
            Push orders, users, YSWSes and shop data to the Airtable base (one way —
            tokens, API keys and PII stay in Postgres).
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending || !configured}
            className="govuk-button govuk-button--secondary"
            title={configured ? undefined : "Set FEATURE_AIRTABLE=true with API key + base id"}
          >
            {pending ? "Syncing…" : "Sync now"}
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
