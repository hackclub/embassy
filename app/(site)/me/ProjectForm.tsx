"use client";

import { useActionState } from "react";
import {
  createProjectAction,
  updateProjectAction,
  type MeFormState,
} from "@/app/actions/me";

interface ProjectFormProps {
  projectId?: string;
  defaultValues?: {
    title?: string;
    description?: string;
    githubUrl?: string;
    demoUrl?: string;
  };
  submitLabel: string;
  pendingLabel: string;
  summary: string;
  open?: boolean;
}

const inputClass = "w-full border-2 border-govuk-black px-3 py-2 text-base";

export default function ProjectForm({
  projectId,
  defaultValues,
  submitLabel,
  pendingLabel,
  summary,
  open,
}: ProjectFormProps) {
  const [state, formAction, pending] = useActionState<MeFormState, FormData>(
    projectId ? updateProjectAction : createProjectAction,
    undefined
  );

  return (
    <details className="mb-2" open={open}>
      <summary className="inline-block cursor-pointer font-bold text-govuk-blue underline underline-offset-4 hover:text-govuk-blue-hover">
        {summary}
      </summary>
      <form action={formAction} className="mt-4 mb-6 max-w-xl space-y-4" noValidate>
        {projectId && <input type="hidden" name="projectId" value={projectId} />}

        <div>
          <label htmlFor={`project-title-${projectId ?? "new"}`} className="mb-2 block font-bold">
            Project title
          </label>
          <input
            id={`project-title-${projectId ?? "new"}`}
            name="title"
            type="text"
            required
            defaultValue={defaultValues?.title}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor={`project-description-${projectId ?? "new"}`}
            className="mb-2 block font-bold"
          >
            Description <span className="font-normal text-govuk-grey-4">(optional)</span>
          </label>
          <textarea
            id={`project-description-${projectId ?? "new"}`}
            name="description"
            rows={4}
            defaultValue={defaultValues?.description}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor={`project-github-${projectId ?? "new"}`}
            className="mb-2 block font-bold"
          >
            Code URL <span className="font-normal text-govuk-grey-4">(GitHub or GitLab, optional)</span>
          </label>
          <input
            id={`project-github-${projectId ?? "new"}`}
            name="githubUrl"
            type="url"
            placeholder="https://github.com/you/your-project"
            defaultValue={defaultValues?.githubUrl}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`project-demo-${projectId ?? "new"}`} className="mb-2 block font-bold">
            Demo URL <span className="font-normal text-govuk-grey-4">(optional)</span>
          </label>
          <input
            id={`project-demo-${projectId ?? "new"}`}
            name="demoUrl"
            type="url"
            placeholder="https://your-project.demo.dev"
            defaultValue={defaultValues?.demoUrl}
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
