import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/org";
import PageHeader from "@/app/components/PageHeader";
import JournalForm from "../JournalForm";
import { deleteJournalAction } from "@/app/actions/me";

function entryDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function dateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function MeJournalPage() {
  const user = await getCurrentUserWithRole();
  if (!user) return null;

  const entries = await prisma.journalEntry.findMany({
    where: { userId: user.id },
    orderBy: { entryDate: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Your journal"
        description="Keep a log of what you work on."
      />

      <JournalForm
        summary="New entry"
        submitLabel="Add entry"
        pendingLabel="Adding..."
        open={entries.length === 0}
      />

      {entries.length === 0 ? (
        <p className="text-govuk-grey-4">
          No journal entries yet. Use &ldquo;New entry&rdquo; above to write your first one.
        </p>
      ) : (
        <ul className="space-y-0" role="list">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="border-t border-govuk-grey-2 py-5 last:border-b"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold">{entry.title}</h2>
                <span className="text-sm text-govuk-grey-4">{entryDate(entry.entryDate)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-govuk-grey-4">{entry.content}</p>

              <div className="mt-3 flex flex-wrap items-start gap-4">
                <JournalForm
                  journalId={entry.id}
                  defaultValues={{
                    title: entry.title,
                    entryDate: dateInputValue(entry.entryDate),
                    content: entry.content,
                  }}
                  summary="Edit"
                  submitLabel="Save changes"
                  pendingLabel="Saving..."
                />
                <form action={deleteJournalAction}>
                  <input type="hidden" name="journalId" value={entry.id} />
                  <button type="submit" className="govuk-button govuk-button--secondary govuk-button--small">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm text-govuk-grey-4">
        Done here? <Link href="/me" className="text-govuk-blue underline underline-offset-4">Back to your whoami</Link>
      </p>
    </>
  );
}
