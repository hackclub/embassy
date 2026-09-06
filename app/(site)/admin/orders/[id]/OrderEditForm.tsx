"use client";

import { useActionState } from "react";
import { updateOrderDetailsAction, type OrderFormState } from "./actions";

export default function OrderEditForm({
  orderId,
  recipientName,
  recipientEmail,
  note,
}: {
  orderId: string;
  recipientName: string;
  recipientEmail: string;
  note: string;
}) {
  const [state, formAction, pending] = useActionState<OrderFormState, FormData>(
    updateOrderDetailsAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="orderId" value={orderId} />

      <div>
        <label htmlFor="recipientName" className="mb-2 block font-bold">
          Recipient name
        </label>
        <input
          id="recipientName"
          name="recipientName"
          type="text"
          required
          defaultValue={recipientName}
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>

      <div>
        <label htmlFor="recipientEmail" className="mb-2 block font-bold">
          Recipient email
        </label>
        <p className="mb-2 text-sm text-govuk-grey-4">
          If this matches a registered participant, the order is linked to their
          account. The tracking link stays the same.
        </p>
        <input
          id="recipientEmail"
          name="recipientEmail"
          type="email"
          required
          defaultValue={recipientEmail}
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
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
          rows={3}
          defaultValue={note}
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
          {state.ok}
        </p>
      )}

      <button type="submit" disabled={pending} className="govuk-button">
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
