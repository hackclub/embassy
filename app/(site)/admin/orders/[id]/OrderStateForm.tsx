"use client";

import { useActionState } from "react";
import {
  updateOrderStateAction,
  type OrderFormState,
} from "./actions";

export const STATE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "AWAITING_RECIPIENT_DETAILS", label: "Awaiting details", description: "Waiting for the recipient to submit their details." },
  { value: "RECIPIENT_DETAILS_RECEIVED", label: "Details received", description: "Recipient details have been received." },
  { value: "DRAFTING", label: "Drafting", description: "The passport is being drafted." },
  { value: "DRAFT_READY", label: "Draft ready", description: "The draft is ready for review." },
  { value: "SENT_TO_HQ", label: "Sent to HQ", description: "Sent to Hack Club HQ for printing." },
  { value: "RECEIVED_FROM_HQ", label: "Received from HQ", description: "HQ has received the passport." },
  { value: "SHIPPING", label: "Shipping", description: "The passport is on its way to the recipient." },
  { value: "DELIVERED", label: "Delivered", description: "The passport has been delivered." },
  { value: "CANCELLED", label: "Cancelled", description: "The order has been cancelled." },
  { value: "ERROR", label: "Error", description: "Something went wrong with this order." },
];

export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "SHIPPED", label: "Shipped" },
];

export default function OrderStateForm({
  orderId,
  currentState,
  status,
}: {
  orderId: string;
  currentState: string;
  status: string;
}) {
  const [state, formAction, pending] = useActionState<OrderFormState, FormData>(
    updateOrderStateAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="orderId" value={orderId} />

      <div>
        <label htmlFor="currentState" className="mb-2 block font-bold">
          State
        </label>
        <select
          id="currentState"
          name="currentState"
          defaultValue={currentState}
          className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
        >
          {STATE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="mt-2 max-w-md text-sm text-govuk-grey-4">
          {STATE_OPTIONS.find((s) => s.value === currentState)?.description}
        </p>
      </div>

      <div>
        <label htmlFor="status" className="mb-2 block font-bold">
          Fulfillment status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="w-full max-w-md border-2 border-govuk-black px-3 py-2 text-base"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="reason" className="mb-2 block font-bold">
          Reason{" "}
          <span className="font-normal text-govuk-grey-4">(optional)</span>
        </label>
        <input
          id="reason"
          name="reason"
          type="text"
          maxLength={300}
          placeholder="Why is the state changing?"
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
        />
        <p className="mt-2 text-sm text-govuk-grey-4">
          Recorded in the order activity feed.
        </p>
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
        {pending ? "Updating..." : "Update state"}
      </button>
    </form>
  );
}
