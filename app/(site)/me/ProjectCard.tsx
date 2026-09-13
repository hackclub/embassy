"use client";

import { useState, useActionState } from "react";
import { createPortal } from "react-dom";
import ProjectForm from "./ProjectForm";
import SubmitForm from "./SubmitForm";
import JournalMarkdown from "./JournalMarkdown";
import { useBodyScrollLock } from "./useBodyScrollLock";
import {
  createJournalAction,
  deleteJournalAction,
  deleteProjectAction,
  type MeFormState,
} from "@/app/actions/me";
import { rescindSubmissionAction } from "@/app/actions/submissions";

const inputClass =
  "w-full rounded-sm border-2 border-govuk-black px-3 py-2 text-base";

export type SubmissionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "ACCEPTED"
  | "REJECTED";

export type ProjectCardData = {
  id: string;
  title: string;
  description: string | null;
  githubUrl: string | null;
  demoUrl: string | null;
  hackatimeProject: string | null;
  aiDeclaration: string | null;
  submissionStatus: SubmissionStatus | null;
  reviewReason: string | null;
  journalEntries: {
    id: string;
    title: string;
    content: string;
    entryDate: string;
  }[];
};

type Dialog = "journal" | "edit" | "submit" | null;

function SubmissionTag({ status }: { status: SubmissionStatus }) {
  const map: Record<SubmissionStatus, { cls: string; label: string }> = {
    DRAFT: { cls: "govuk-tag--grey", label: "Draft" },
    SUBMITTED: { cls: "govuk-tag--blue", label: "Under review" },
    ACCEPTED: { cls: "govuk-tag--green", label: "Accepted" },
    REJECTED: { cls: "govuk-tag--grey", label: "Rejected" },
  };
  const t = map[status];
  return <span className={`govuk-tag ${t.cls}`}>{t.label}</span>;
}

export default function ProjectCard({ project }: { project: ProjectCardData }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  useBodyScrollLock(dialog !== null);

  const submitted =
    project.submissionStatus === "SUBMITTED" ||
    project.submissionStatus === "ACCEPTED";

  return (
    <div className="project-card project-card-clickable relative">
      <button
        type="button"
        onClick={() => setDialog("journal")}
        className="absolute inset-0 z-0"
        aria-haspopup="dialog"
        aria-label={`Open journal for ${project.title}`}
      />
      <div className="pointer-events-none relative z-10 p-4">
        <h3 className="text-base leading-tight">{project.title}</h3>
        {project.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-govuk-grey-4">
            {project.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-xs text-govuk-grey-4">
            {project.journalEntries.length}{" "}
            {project.journalEntries.length === 1 ? "entry" : "entries"} · tap to
            journal
          </p>
          {project.submissionStatus && (
            <SubmissionTag status={project.submissionStatus} />
          )}
        </div>
        {project.reviewReason &&
          (project.submissionStatus === "REJECTED" ||
            project.submissionStatus === "ACCEPTED") && (
            <p className="mt-2 line-clamp-2 rounded-md border-l-4 border-govuk-green bg-govuk-grey-1 px-3 py-2 text-xs leading-relaxed">
              <span className="font-bold">
                {project.submissionStatus === "REJECTED"
                  ? "Rejected"
                  : "Accepted"}
                :
              </span>{" "}
              {project.reviewReason}
            </p>
          )}
        <div className="mt-3 flex items-center gap-3 text-xs">
          {project.githubUrl ? (
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
            >
              Code
            </a>
          ) : (
            <span className="text-govuk-grey-4">No code link yet</span>
          )}
          {project.demoUrl && (
            <a
              href={project.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
            >
              Demo
            </a>
          )}
          {project.submissionStatus === "SUBMITTED" ? (
            <RescindButton projectId={project.id} title={project.title} />
          ) : !submitted ? (
            <button
              type="button"
              onClick={() => setDialog("submit")}
              className="pointer-events-auto ml-auto font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
            >
              Submit
            </button>
          ) : null}
          {!submitted && (
            <button
              type="button"
              onClick={() => setDialog("edit")}
              className="pointer-events-auto font-semibold text-govuk-grey-4 underline underline-offset-4 hover:text-govuk-black"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {dialog &&
        createPortal(
          <div
            className="game-popup-backdrop"
            onClick={() => setDialog(null)}
            role="presentation"
          >
            <div
              className="game-popup"
              role="dialog"
              aria-modal="true"
              aria-label={
                dialog === "edit"
                  ? "Edit project"
                  : dialog === "submit"
                    ? `Submit ${project.title}`
                    : `${project.title} journal`
              }
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold">
                  {dialog === "edit"
                    ? "Edit project"
                    : dialog === "submit"
                      ? `Submit — ${project.title}`
                      : `${project.title} — journal`}
                </h2>
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                  className="text-2xl leading-none text-govuk-grey-4 hover:text-govuk-black"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {submitted && (
                <p className="mb-4 rounded-md border-l-4 border-govuk-blue bg-govuk-grey-1 px-3 py-2 text-sm font-semibold text-govuk-black">
                  {project.submissionStatus === "ACCEPTED"
                    ? "This project was accepted — its details are locked."
                    : "This project is under review — its details are locked."}
                </p>
              )}

              {dialog === "edit" ? (
                <>
                  <ProjectForm
                    projectId={project.id}
                    defaultValues={{
                      title: project.title,
                      description: project.description ?? undefined,
                      githubUrl: project.githubUrl ?? undefined,
                      demoUrl: project.demoUrl ?? undefined,
                      hackatimeProject: project.hackatimeProject,
                      aiDeclaration: project.aiDeclaration ?? undefined,
                    }}
                    onSuccess={() => setDialog(null)}
                  />
                  <form
                    action={async (formData) => {
                      if (
                        !window.confirm(
                          `Delete "${project.title}"? This also deletes its ${project.journalEntries.length} journal ${project.journalEntries.length === 1 ? "entry" : "entries"}.`,
                        )
                      ) {
                        return;
                      }
                      await deleteProjectAction(formData);
                      setDialog(null);
                    }}
                    className="mt-4 border-t-2 border-dashed border-govuk-grey-2 pt-3"
                  >
                    <input type="hidden" name="projectId" value={project.id} />
                    <button
                      type="submit"
                      className="text-sm font-semibold text-hc-red underline underline-offset-4 hover:opacity-80"
                    >
                      Delete project
                    </button>
                  </form>
                </>
              ) : dialog === "submit" ? (
                <SubmitForm
                  project={project}
                  onSuccess={() => setDialog(null)}
                />
              ) : (
                <JournalPanel project={project} />
              )}

              {dialog !== "submit" && !submitted && (
                <div className="mt-4 border-t-2 border-dashed border-govuk-grey-2 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setDialog(dialog === "edit" ? "journal" : "edit")
                    }
                    className="text-sm font-semibold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover"
                  >
                    {dialog === "edit"
                      ? "Back to journal"
                      : "Edit project details"}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function RescindButton({
  projectId,
  title,
}: {
  projectId: string;
  title: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <form
      action={async () => {
        if (
          !window.confirm(
            `Rescind "${title}"? Reviewers will no longer see this submission and you'll be able to edit and resubmit.`,
          )
        ) {
          return;
        }
        setBusy(true);
        await rescindSubmissionAction(projectId);
      }}
      className="pointer-events-auto ml-auto"
    >
      <button
        type="submit"
        disabled={busy}
        className="font-semibold text-hc-red underline underline-offset-4 hover:opacity-80 disabled:opacity-50"
      >
        {busy ? "Rescinding..." : "Rescind"}
      </button>
    </form>
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
    undefined,
  );
  const [content, setContent] = useState("");
  const [touched, setTouched] = useState(false);
  const contentLength = content.trim().length;
  const tooShort = touched && contentLength < 10;

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
          <label
            htmlFor={`entry-content-${project.id}`}
            className="mb-2 block font-bold"
          >
            What did you build today?{" "}
            <span className="font-normal text-govuk-grey-4">
              (markdown supported)
            </span>
          </label>
          <textarea
            id={`entry-content-${project.id}`}
            name="content"
            rows={5}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={"- shipped the login flow\n- fixed **two** bugs"}
            className={`${inputClass} font-mono text-sm ${
              tooShort ? "border-hc-red border-4" : ""
            }`}
          />
          {contentLength > 0 && contentLength < 10 && (
            <p
              id={`entry-content-error-${project.id}`}
              className="mt-2 text-sm font-semibold text-hc-red"
            >
              {10 - contentLength} more character
              {10 - contentLength === 1 ? "" : "s"} needed
            </p>
          )}
        </div>
        {state?.error && (
          <p
            role="alert"
            className="border-l-4 border-hc-red px-3 py-2 font-semibold"
          >
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || contentLength < 10}
          className="govuk-button"
        >
          {pending ? "Adding..." : "Add entry"}
        </button>
      </form>
    </div>
  );
}