"use client";

import { useActionState } from "react";
import { addOrganizerAction } from "@/app/actions/admin";

export default function AddOrganizerForm() {
  const [state, formAction, pending] = useActionState(addOrganizerAction, undefined);

  return (
    <form action={formAction} className="mt-4 space-y-6" noValidate>
      <div>
        <label htmlFor="email" className="mb-2 block font-bold">
          Their email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>

      <div>
        <label htmlFor="orgName" className="mb-2 block font-bold">
          YSWS name
        </label>
        <input
          id="orgName"
          name="orgName"
          type="text"
          required
          className="w-full max-w-xl border-2 border-govuk-black px-3 py-2 text-base"
        />
      </div>

      <div>
        <label htmlFor="orgSlug" className="mb-2 block font-bold">
          Slug
        </label>
        <p className="mb-2 text-sm text-govuk-grey-4">
          Lowercase letters, numbers and dashes.
        </p>
        <input
          id="orgSlug"
          name="orgSlug"
          type="text"
          required
          pattern="[a-z0-9-]+"
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
          {state.ok}
        </p>
      )}

      <button type="submit" disabled={pending} className="govuk-button">
        {pending ? "Registering..." : "Register organizer"}
      </button>
    </form>
  );
}
