"use client";

import { useActionState } from "react";
import { createOrderAction } from "@/app/actions/org";

export default function CreateOrderForm({ orgId, yswsId }: { orgId: string; yswsId?: string | null }) {
  const [state, formAction, pending] = useActionState(createOrderAction, undefined);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="orgId" value={orgId} />
      {yswsId && <input type="hidden" name="yswsId" value={yswsId} />}

      <div>
        <label htmlFor="recipientName" className="block font-bold mb-1">
          Recipient name
        </label>
        <input
          id="recipientName"
          name="recipientName"
          type="text"
          required
          className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
          placeholder="Full name for the passport"
        />
      </div>

      <div>
        <label htmlFor="recipientEmail" className="block font-bold mb-1">
          Recipient email
        </label>
        <p className="text-sm text-govuk-grey-4 mb-1">
          Required. If they have an account, the passport links to it.
        </p>
        <input
          id="recipientEmail"
          name="recipientEmail"
          type="email"
          required
          className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
          placeholder="participant@example.com"
        />
      </div>

      <div>
        <label htmlFor="note" className="block font-bold mb-1">
          Note <span className="font-normal text-govuk-grey-4">(optional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          placeholder="Shipping address, event dates, anything we should know"
          className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
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
        {pending ? "Creating..." : "Create order"}
      </button>
    </form>
  );
}