"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buyPassportAction, type ShopFormState } from "@/app/actions/me";

interface BuyPassportFormProps {
  disabled?: boolean;
  hint?: string;
}

export default function BuyPassportForm({ disabled = false, hint }: BuyPassportFormProps) {
  const [state, action, pending] = useActionState<ShopFormState, FormData>(
    buyPassportAction,
    undefined
  );

  if (state?.ok && state.trackUrl) {
    return (
      <div className="govuk-notification-banner govuk-notification-banner--success" role="alert">
        <p className="font-bold">Your passport order is in!</p>
        <p>{state.ok}</p>
        <Link href={state.trackUrl} className="govuk-button mt-3">
          Track your passport
        </Link>
      </div>
    );
  }

  return (
    <div>
      {state?.error && (
        <div className="govuk-notification-banner govuk-notification-banner--error mb-4" role="alert">
          <p className="font-bold">{state.error}</p>
        </div>
      )}
      <form action={action}>
        <button
          type="submit"
          name="intent"
          value="passport"
          className="govuk-button"
          disabled={pending || disabled}
        >
          {pending ? "Ordering..." : "Buy passport — 7 credits"}
        </button>
      </form>
      {hint && !pending && <p className="mt-2 text-sm text-govuk-grey-4">{hint}</p>}
    </div>
  );
}
