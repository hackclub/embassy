"use client";

import { useActionState, useEffect } from "react";
import { updateJournalAction, type MeFormState } from "@/app/actions/me";

const inputClass = "w-full border-2 border-govuk-black px-3 py-2 text-base";

type JournalEntryData = {
  id: string;
  title: string;
  content: string;
  entryDate: string;
  projectId: string | null;
};

export default function JournalEntryEditForm({
  entry,
  projects,
  onCancelled,
  onSaved,
}: {
  entry: JournalEntryData;
  projects: { id: string; title: string }[];
  onCancelled: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState<MeFormState, FormData>(
    updateJournalAction,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="journalId" value={entry.id} />

      <div>
        <label htmlFor={`journal-entry-project-${entry.id}`} className="mb-2 block font-bold">
          Project
        </label>
        <select
          id={`journal-entry-project-${entry.id}`}
          name="projectId"
          required
          defaultValue={entry.projectId ?? ""}
          className={inputClass}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`journal-entry-title-${entry.id}`} className="mb-2 block font-bold">
          Title
        </label>
        <input
          id={`journal-entry-title-${entry.id}`}
          name="title"
          type="text"
          required
          defaultValue={entry.title}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={`journal-entry-date-${entry.id}`} className="mb-2 block font-bold">
          Entry date
        </label>
        <input
          id={`journal-entry-date-${entry.id}`}
          name="entryDate"
          type="date"
          required
          defaultValue={entry.entryDate}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={`journal-entry-content-${entry.id}`} className="mb-2 block font-bold">
          What did you work on?
        </label>
        <textarea
          id={`journal-entry-content-${entry.id}`}
          name="content"
          rows={8}
          required
          defaultValue={entry.content}
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p role="alert" className="border-l-4 border-hc-red px-3 py-2 font-semibold">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="govuk-button">
          {pending ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancelled}
          className="text-sm font-semibold text-govuk-grey-4 underline underline-offset-4 hover:text-govuk-black"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}