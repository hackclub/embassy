"use client";

import { useActionState } from "react";
import {
  createJournalAction,
  updateJournalAction,
  type MeFormState,
} from "@/app/actions/me";

interface JournalFormProps {
  journalId?: string;
  defaultValues?: {
    title?: string;
    entryDate?: string;
    content?: string;
  };
  submitLabel: string;
  pendingLabel: string;
  summary: string;
  open?: boolean;
}

const inputClass = "w-full border-2 border-govuk-black px-3 py-2 text-base";

export default function JournalForm({
  journalId,
  defaultValues,
  submitLabel,
  pendingLabel,
  summary,
  open,
}: JournalFormProps) {
  const [state, formAction, pending] = useActionState<MeFormState, FormData>(
    journalId ? updateJournalAction : createJournalAction,
    undefined
  );

  return (
    <details className="mb-2" open={open}>
      <summary className="inline-block cursor-pointer font-bold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover">
        {summary}
      </summary>
      <form action={formAction} className="mt-4 mb-6 max-w-xl space-y-4" noValidate>
        {journalId && <input type="hidden" name="journalId" value={journalId} />}

        <div>
          <label htmlFor={`journal-title-${journalId ?? "new"}`} className="mb-2 block font-bold">
            Title
          </label>
          <input
            id={`journal-title-${journalId ?? "new"}`}
            name="title"
            type="text"
            required
            defaultValue={defaultValues?.title}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor={`journal-date-${journalId ?? "new"}`}
            className="mb-2 block font-bold"
          >
            Entry date
          </label>
          <input
            id={`journal-date-${journalId ?? "new"}`}
            name="entryDate"
            type="date"
            required
            defaultValue={defaultValues?.entryDate}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`journal-content-${journalId ?? "new"}`} className="mb-2 block font-bold">
            What did you work on?
          </label>
          <textarea
            id={`journal-content-${journalId ?? "new"}`}
            name="content"
            rows={8}
            required
            defaultValue={defaultValues?.content}
            className={inputClass}
          />
        </div>

        {state?.error && (
          <p role="alert" className="border-l-4 border-hc-red px-3 py-2 font-semibold">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="border-l-4 border-govuk-green px-3 py-2 font-semibold">{state.ok}</p>
        )}

        <button type="submit" disabled={pending} className="govuk-button">
          {pending ? pendingLabel : submitLabel}
        </button>
      </form>
    </details>
  );
}
