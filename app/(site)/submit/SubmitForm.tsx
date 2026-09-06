"use client";

import { useActionState } from "react";
import { submitProjectAction } from "@/app/actions/submissions";

export default function SubmitForm() {
  const [state, formAction, pending] = useActionState(submitProjectAction, undefined);

  return (
    <form action={formAction} className="mt-6 space-y-6" noValidate>
      <div>
        <label htmlFor="title" className="mb-2 block font-bold">
          What did you build?
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-2 block font-bold">
          Tell us about it{" "}
          <span className="font-normal text-govuk-grey-4">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>

      <div>
        <label htmlFor="url" className="mb-2 block font-bold">
          Link to your project{" "}
          <span className="font-normal text-govuk-grey-4">(optional)</span>
        </label>
        <input
          id="url"
          name="url"
          type="url"
          placeholder="https://..."
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>

      {state?.error && (
        <p role="alert" className="border-l-4 border-hc-red px-3 py-2 font-semibold">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="border-l-4 border-govuk-green px-3 py-2 font-semibold">
          Submitted. Your project is now in the gallery.
        </p>
      )}

      <button type="submit" disabled={pending} className="govuk-button">
        {pending ? "Submitting..." : "Submit project"}
      </button>
    </form>
  );
}
