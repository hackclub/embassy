"use client";

import { useActionState } from "react";
import { setRoleAction } from "@/app/actions/admin";

export default function SetRoleForm() {
  const [state, formAction, pending] = useActionState(setRoleAction, undefined);

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
        <label htmlFor="role" className="mb-2 block font-bold">
          Role
        </label>
        <select
          id="role"
          name="role"
          required
          className="w-full max-w-xs border-2 border-govuk-black px-3 py-2 text-base"
        >
          <option value="PARTICIPANT">Participant</option>
          <option value="ORGANIZER">Organizer</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPERADMIN">Superadmin</option>
        </select>
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
        {pending ? "Saving..." : "Set role"}
      </button>
    </form>
  );
}
