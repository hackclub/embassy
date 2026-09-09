"use client";

import { useActionState, useEffect, useState } from "react";
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
    hackatimeProject?: string | null;
  };
  onSuccess?: () => void;
}

const inputClass =
  "w-full rounded-sm border-2 border-govuk-black px-3 py-2 text-base";

export default function ProjectForm({
  projectId,
  defaultValues,
  onSuccess,
}: ProjectFormProps) {
  const [state, formAction, pending] = useActionState<MeFormState, FormData>(
    projectId ? updateProjectAction : createProjectAction,
    undefined,
  );

  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [linkedHackatime, setLinkedHackatime] = useState(
    defaultValues?.hackatimeProject ?? null,
  );
  const [hackatimeProjects, setHackatimeProjects] = useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hackatime/projects")
      .then((res) => (res.ok ? res.json() : Promise.resolve({ projects: [] })))
      .then((data: { projects?: string[] }) => {
        if (cancelled) return;
        setHackatimeProjects(data.projects ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingProjects(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state?.ok) onSuccess?.();
  }, [state, onSuccess]);

  const options =
    linkedHackatime && !hackatimeProjects.includes(linkedHackatime)
      ? [linkedHackatime, ...hackatimeProjects]
      : hackatimeProjects;

  return (
    <form action={formAction} className="text-left space-y-4" noValidate>
      {projectId && <input type="hidden" name="projectId" value={projectId} />}

      <div>
        <label
          htmlFor={`project-title-${projectId ?? "new"}`}
          className="mb-2 block font-bold"
        >
          Project title
        </label>
        <input
          id={`project-title-${projectId ?? "new"}`}
          name="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor={`project-description-${projectId ?? "new"}`}
          className="mb-2 block font-bold"
        >
          Description{" "}
          <span className="font-normal text-govuk-grey-4">
            (you can add one later)
          </span>
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
        <span className="mb-2 block font-bold">
          Hackatime project{" "}
          <span className="font-normal text-govuk-grey-4">
            (you can link one later)
          </span>
        </span>
        {loadingProjects ? (
          <select
            disabled
            aria-busy="true"
            className={`${inputClass} text-govuk-grey-4`}
          >
            <option value="">Loading hackatime projects...</option>
          </select>
        ) : options.length > 0 || linkedHackatime ? (
          <select
            id={`project-hackatime-${projectId ?? "new"}`}
            name="hackatimeProject"
            value={linkedHackatime ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setLinkedHackatime(value || null);
              if (value) setTitle(value);
            }}
            className={inputClass}
          >
            <option value="">-- None Selected --</option>
            {options.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : (
          <select disabled className={`${inputClass} text-govuk-grey-4`}>
            <option value="">Hackatime not connected...</option>
          </select>
        )}
      </div>

      <div>
        <label
          htmlFor={`project-github-${projectId ?? "new"}`}
          className="mb-2 block font-bold"
        >
          Code URL{" "}
          <span className="font-normal text-govuk-grey-4">
            (a git repository link; you can add it later)
          </span>
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
        <label
          htmlFor={`project-demo-${projectId ?? "new"}`}
          className="mb-2 block font-bold"
        >
          Demo URL{" "}
          <span className="font-normal text-govuk-grey-4">
            (you can add one later)
          </span>
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
        <p
          role="alert"
          className="border-l-4 border-hc-red px-3 py-2 font-semibold"
        >
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="govuk-button">
        {pending ? "Saving..." : projectId ? "Save changes" : "Create project"}
      </button>
    </form>
  );
}
