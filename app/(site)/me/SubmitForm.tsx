"use client";

import { useActionState, useEffect } from "react";
import {
  submitProjectAction,
  type SubmitFormState,
} from "@/app/actions/submissions";
import type { ProjectCardData } from "./ProjectCard";

const inputClass =
  "w-full rounded-sm border-2 border-govuk-black px-3 py-2 text-base";

export default function SubmitForm({
  project,
  onSuccess,
}: {
  project: ProjectCardData;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    SubmitFormState,
    FormData
  >(submitProjectAction, undefined);

  const link = project.githubUrl ?? project.demoUrl;

  useEffect(() => {
    if (state?.ok) onSuccess?.();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="projectId" value={project.id} />

      <div className="space-y-2 rounded-lg border border-govuk-grey-2 bg-govuk-grey-1 p-4">
        <h3 className="font-bold">{project.title}</h3>
        {project.description ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-govuk-grey-4">
            {project.description}
          </p>
        ) : (
          <p className="text-sm italic text-govuk-grey-4">No description.</p>
        )}
        {link ? (
          <p className="text-sm font-semibold text-govuk-blue">{link}</p>
        ) : (
          <p className="text-sm italic text-govuk-grey-4">
            No code or demo link yet — add one in “Edit” before submitting.
          </p>
        )}
      </div>

      {!project.hackatimeProject && (
        <p className="border-l-4 border-govuk-yellow bg-[#fff7e6] px-3 py-2 text-sm font-semibold">
          This project isn’t linked to a Hackatime project — no hours will be
          snapshotted, so you’d get 0 credits on acceptance. Add one in “Edit”
          first.
        </p>
      )}

      <div>
        <label
          htmlFor={`note-for-reviewer-${project.id}`}
          className="mb-2 block font-bold"
        >
          Note to reviewer{" "}
          <span className="font-normal text-govuk-grey-4">(optional)</span>
        </label>
        <textarea
          id={`note-for-reviewer-${project.id}`}
          name="noteForReviewer"
          rows={4}
          placeholder="Anything the reviewer should know — what to look at, how you built it, what's still rough..."
          className={inputClass}
        />
      </div>

      <p className="text-sm text-govuk-grey-4">
        Submitting snapshots your tracked hours on the linked Hackatime project
        (from the start date onward) so reviewers can award credits against a
        consistent number.
      </p>

      {state?.error && (
        <p
          role="alert"
          className="border-l-4 border-hc-red px-3 py-2 font-semibold"
        >
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="border-l-4 border-govuk-green px-3 py-2 font-semibold">
          {state.ok}
        </p>
      )}

      <button type="submit" disabled={pending} className="govuk-button">
        {pending ? "Submitting..." : "Submit for review"}
      </button>
    </form>
  );
}
