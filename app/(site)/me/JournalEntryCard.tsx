"use client";

import { useState } from "react";
import Link from "next/link";
import JournalMarkdown from "./JournalMarkdown";
import JournalEntryEditForm from "./JournalEntryEditForm";
import { deleteJournalAction } from "@/app/actions/me";

export type JournalEntryData = {
  id: string;
  title: string;
  content: string;
  entryDate: string;
  projectId: string | null;
  project: { id: string; title: string } | null;
};

export default function JournalEntryCard({
  entry,
  projects,
}: {
  entry: JournalEntryData;
  projects: { id: string; title: string }[];
}) {
  const [editing, setEditing] = useState(false);

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(entry.entryDate));

  return (
    <li className="game-box !p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold leading-tight">{entry.title}</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-govuk-grey-4">{dateLabel}</span>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <form
            action={async (formData) => {
              if (!window.confirm("Delete this journal entry?")) return;
              await deleteJournalAction(formData);
            }}
          >
            <input type="hidden" name="journalId" value={entry.id} />
            <button
              type="submit"
              className="font-semibold text-hc-red underline underline-offset-4 hover:opacity-80"
            >
              Delete
            </button>
          </form>
        </div>
      </div>
      {entry.project && (
        <Link
          href="/me/projects"
          className="govuk-tag govuk-tag--grey mb-3 inline-block text-xs"
        >
          {entry.project.title}
        </Link>
      )}
      {editing ? (
        <JournalEntryEditForm
          entry={entry}
          projects={projects}
          onCancelled={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <JournalMarkdown content={entry.content} />
      )}
    </li>
  );
}