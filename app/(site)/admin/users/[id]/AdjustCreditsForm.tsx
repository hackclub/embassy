"use client";

import { useActionState } from "react";
import { adjustCreditsAction, type AdminFormState } from "@/app/actions/admin";

const inputClass = "w-full border-2 border-govuk-black px-3 py-2 text-base";

export default function AdjustCreditsForm({
  userId,
  balance,
}: {
  userId: string;
  balance: number;
}) {
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(
    adjustCreditsAction,
    undefined,
  );

  return (
    <div>
      <p className="mb-3">
        Balance:{" "}
        <span className="text-xl font-bold">{balance}</span> credits
      </p>
      <form action={formAction} className="space-y-3" noValidate>
        <input type="hidden" name="userId" value={userId} />
        <div>
          <label htmlFor="credit-amount" className="mb-1 block font-bold">
            Amount
          </label>
          <input
            id="credit-amount"
            name="amount"
            type="number"
            step="1"
            required
            placeholder="e.g. 25 or -10"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="credit-description" className="mb-1 block font-bold">
            Reason
          </label>
          <input
            id="credit-description"
            name="description"
            type="text"
            required
            placeholder="e.g. free swag, refund, contest prize"
            className={inputClass}
          />
        </div>
        {state?.error && (
          <p role="alert" className="border-l-4 border-hc-red px-3 py-1 font-semibold">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="border-l-4 border-govuk-green px-3 py-1 font-semibold">
            {state.ok}
          </p>
        )}
        <button type="submit" disabled={pending} className="govuk-button">
          {pending ? "Applying..." : "Apply credits"}
        </button>
      </form>
    </div>
  );
}