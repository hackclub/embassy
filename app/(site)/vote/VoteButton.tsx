"use client";

import { useFormStatus } from "react-dom";
import { voteAction } from "@/app/actions/submissions";

export default function VoteButton({
  submissionId,
}: {
  submissionId: string;
}) {
  return (
    <form action={voteAction}>
      <input type="hidden" name="submissionId" value={submissionId} />
      <VoteSubmit />
    </form>
  );
}

function VoteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="govuk-button govuk-button--small"
    >
      {pending ? "Voting..." : "Vote"}
    </button>
  );
}
