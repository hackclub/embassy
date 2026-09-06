"use client";

import { useActionState } from "react";
import { issuePassportAdminAction } from "@/app/actions/admin";

export default function IssuePassportAdminForm({
  orgs,
}: {
  orgs: { id: string; name: string; slug: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    issuePassportAdminAction,
    undefined
  );

  return (
    <form action={formAction} className="mt-4 space-y-6" noValidate>
      <div>
        <label htmlFor="orgId" className="mb-2 block font-bold">
          YSWS org
        </label>
        <select
          id="orgId"
          name="orgId"
          required
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
        >
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name} ({org.slug})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="recipientName" className="mb-2 block font-bold">
          Recipient name
        </label>
        <input
          id="recipientName"
          name="recipientName"
          type="text"
          required
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
          placeholder="Full name for the passport"
        />
      </div>

      <div>
        <label htmlFor="recipientEmail" className="mb-2 block font-bold">
          Recipient email
        </label>
        <p className="mb-2 text-sm text-govuk-grey-4">
          Required. If this matches a registered participant, the passport is connected to their account.
        </p>
        <input
          id="recipientEmail"
          name="recipientEmail"
          type="email"
          required
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
          placeholder="participant@example.com"
        />
      </div>

      <div>
        <label htmlFor="note" className="mb-2 block font-bold">
          Note{" "}
          <span className="font-normal text-govuk-grey-4">(optional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          placeholder="Shipping address, event dates, anything we should know"
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>

      {state?.error && (
        <p role="alert" className="border-l-4 border-hc-red px-3 py-2 font-semibold bg-govuk-grey-1">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="border-l-4 border-govuk-green px-3 py-2 font-semibold bg-govuk-grey-1">
          Order created. We&apos;ll be in touch with next steps.
        </p>
      )}

      <button type="submit" disabled={pending} className="govuk-button">
        {pending ? "Creating..." : "Create passport order"}
      </button>
    </form>
  );
}
