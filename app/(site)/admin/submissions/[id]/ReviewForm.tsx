"use client";

import { useActionState } from "react";
import { reviewSubmissionAction, type ReviewFormState } from "@/app/actions/review";

export default function ReviewForm({
  submissionId,
  alreadyReviewed,
  defaultHours,
  defaultCredits,
}: {
  submissionId: string;
  alreadyReviewed: boolean;
  defaultHours: number | null;
  defaultCredits: number;
}) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(
    reviewSubmissionAction,
    undefined,
  );

  return (
    <div>
      {state?.error && (
        <p role="alert" className="mb-4 border-l-4 border-hc-red px-3 py-2 font-semibold">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mb-4 border-l-4 border-govuk-green px-3 py-2 font-semibold">
          Review saved.
        </p>
      )}

      {alreadyReviewed ? (
        <div className="govuk-inset">
          <p className="font-semibold">This submission has already been reviewed.</p>
          <p className="mt-1 text-sm text-govuk-grey-4">
            Credits can only be awarded once per submission.
          </p>
        </div>
      ) : (
        <form action={action} className="space-y-6" noValidate>
          <input type="hidden" name="submissionId" value={submissionId} />

          <div>
            <label htmlFor="hoursOverride" className="mb-2 block font-bold">
              Tracked hours to award on (optional — defaults to the snapshot)
            </label>
            <input
              id="hoursOverride"
              name="hoursOverride"
              type="number"
              min="0"
              step="0.01"
              defaultValue={defaultHours ?? ""}
              placeholder={defaultHours?.toString() ?? "No snapshot"}
              className="w-full max-w-xs border-2 border-govuk-black px-3 py-2 text-base"
            />
            <p className="mt-1 text-sm text-govuk-grey-4">
              Snapshotted hours → {defaultCredits} credits. Set a lower value to deflate.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="submit"
              name="decision"
              value="ACCEPTED"
              disabled={pending}
              className="govuk-button"
            >
              {pending ? "Saving..." : `Accept — award ~${defaultCredits} credits`}
            </button>
            <button
              type="submit"
              name="decision"
              value="REJECTED"
              disabled={pending}
              className="govuk-button govuk-button--secondary"
            >
              Reject
            </button>
          </div>
        </form>
      )}
    </div>
  );
}