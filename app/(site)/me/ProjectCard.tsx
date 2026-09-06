"use client";

import { useState, useActionState } from "react";
import ProjectForm from "./ProjectForm";
import JournalMarkdown from "./JournalMarkdown";
import {
  createJournalAction,
  deleteJournalAction,
  type MeFormState,
} from "@/app/actions/me";

const inputClass = "w-full rounded-xl border-2 border-govuk-black px-3 py-2 text-base";

export type ProjectCardData = {
  id: string;
  title: string;
  description: string | null;
  githubUrl: string | null;
  demoUrl: string | null;
  journalEntries: { id: string; title: string; content: string; entryDate: string }[];
};

export default function ProjectCard({ project }: { project: ProjectCardData }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className="game-box flex flex-col !p-0">
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setOpen(true);
        }}
        className="block w-full rounded-t-[21px] p-5 text-left"
        aria-haspopup="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold leading-tight">{project.title}</h3>
          <span className="game-box__plus shrink-0 !h-8 !w-8 !text-lg" aria-hidden="true">
            +
          </span>
        </div>
        {project.description && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-govuk-grey-4">
            {project.description}
          </p>
        )}
        <p className="mt-3 text-sm font-semibold text-govuk-blue">
          {project.journalEntries.length}{" "}
          {project.journalEntries.length === 1 ? "entry" : "entries"} — tap to journal
        </p>
      </button>

      <div className="flex items-center gap-4 border-t-2 border-dashed border-govuk-grey-2 px-5 py-3">
        {project.githubUrl ? (
          <a
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
          >
            Code
          </a>
        ) : (
          <span className="text-sm text-govuk-grey-4">No code link yet</span>
        )}
        {project.demoUrl && (
          <a
            href={project.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
          >
            Demo
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setOpen(true);
          }}
          className="ml-auto text-sm font-semibold text-govuk-grey-4 underline underline-offset-4 hover:text-govuk-black"
        >
          Edit
        </button>
      </div>

      {open && (
        <div
          className="game-popup-backdrop"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="game-popup"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit project" : `${project.title} journal`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">
                {editing ? "Edit project" : `${project.title} — journal`}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-2xl leading-none text-govuk-grey-4 hover:text-govuk-black"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {editing ? (
              <ProjectForm
                projectId={project.id}
                defaultValues={{
                  title: project.title,
                  description: project.description ?? undefined,
                  githubUrl: project.githubUrl ?? undefined,
                  demoUrl: project.demoUrl ?? undefined,
                }}
                onSuccess={() => setOpen(false)}
              />
            ) : (
              <JournalPanel project={project} />
            )}

            <div className="mt-4 border-t-2 border-dashed border-govuk-grey-2 pt-3">
              <button
                type="button"
                onClick={() => setEditing(!editing)}
                className="text-sm font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
              >
                {editing ? "Back to journal" : "Edit project details"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function JournalPanel({ project }: { project: ProjectCardData }) {
  return (
    <div>
      {project.journalEntries.length === 0 ? (
        <p className="text-govuk-grey-4">
          No entries yet. Write the first devlog for this project below.
        </p>
      ) : (
        <ul className="space-y-4" role="list">
          {project.journalEntries.map((entry) => (
            <li
              key={entry.id}
              className="border-b-2 border-dashed border-govuk-grey-2 pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold leading-tight">{entry.title}</h3>
                <span className="shrink-0 text-sm text-govuk-grey-4">
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(new Date(entry.entryDate))}
                </span>
              </div>
              <JournalMarkdown content={entry.content} />
              <DeleteEntryButton entryId={entry.id} />
            </li>
          ))}
        </ul>
      )}

      <NewEntryForm project={project} />
    </div>
  );
}

function DeleteEntryButton({ entryId }: { entryId: string }) {
  const [deleting, setDeleting] = useState(false);

  return (
    <form
      action={async (formData) => {
        setDeleting(true);
        await deleteJournalAction(formData);
      }}
      className="mt-1"
    >
      <input type="hidden" name="journalId" value={entryId} />
      <button
        type="submit"
        disabled={deleting}
        className="text-sm font-semibold text-hc-red underline underline-offset-4 hover:opacity-80"
      >
        {deleting ? "Deleting..." : "Delete entry"}
      </button>
    </form>
  );
}

function NewEntryForm({ project }: { project: ProjectCardData }) {
  const [state, formAction, pending] = useActionState<MeFormState, FormData>(
    createJournalAction,
    undefined
  );

  return (
    <div className="mt-6 border-t-2 border-dashed border-govuk-grey-2 pt-4">
      <h3 className="mb-2 font-bold">New entry</h3>
      <form action={formAction} className="space-y-3" noValidate>
        <input type="hidden" name="projectId" value={project.id} />
        <input
          type="hidden"
          name="title"
          value={`Devlog — ${new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}`}
        />
        <div>
          <label htmlFor={`entry-content-${project.id}`} className="mb-2 block font-bold">
            What did you build today?{" "}
            <span className="font-normal text-govuk-grey-4">(markdown supported)</span>
          </label>
          <textarea
            id={`entry-content-${project.id}`}
            name="content"
            rows={5}
            required
            placeholder={"- shipped the login flow\n- fixed **two** bugs"}
            className={`${inputClass} font-mono text-sm`}
          />
        </div>
        {state?.error && (
          <p role="alert" className="border-l-4 border-hc-red px-3 py-2 font-semibold">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className="govuk-button">
          {pending ? "Adding..." : "Add entry"}
        </button>
      </form>
    </div>
  );
}
