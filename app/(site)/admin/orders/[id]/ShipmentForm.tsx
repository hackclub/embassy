"use client";

import { useActionState } from "react";
import { createShipmentAction } from "./actions";

export default function ShipmentForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(createShipmentAction, undefined);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <label htmlFor="carrier" className="block text-sm font-bold">
          Carrier
        </label>
        <input
          id="carrier"
          name="carrier"
          type="text"
          required
          placeholder="USPS"
          className="mt-1 w-full border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>
      <div>
        <label htmlFor="trackingNumber" className="block text-sm font-bold">
          Tracking number
        </label>
        <input
          id="trackingNumber"
          name="trackingNumber"
          type="text"
          required
          placeholder="9400 1000 0000 0000 0000 00"
          className="mt-1 w-full border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>
      <div>
        <label htmlFor="note" className="block text-sm font-bold">
          Note <span className="font-normal text-govuk-grey-4">(optional)</span>
        </label>
        <input
          id="note"
          name="note"
          type="text"
          maxLength={300}
          className="mt-1 w-full border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>
      {state?.error && (
        <p role="alert" className="border-l-4 border-hc-red px-3 py-1.5 text-sm font-semibold">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="border-l-4 border-govuk-green px-3 py-1.5 text-sm font-semibold">
          {state.ok}
        </p>
      )}
      <button type="submit" disabled={pending} className="govuk-button">
        {pending ? "Adding…" : "Add shipment"}
      </button>
    </form>
  );
}
