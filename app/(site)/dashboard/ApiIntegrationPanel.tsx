"use client";

import { useActionState, useState } from "react";
import { regenerateApiKeyAction } from "@/app/actions/org";

export default function ApiIntegrationPanel({ 
  orgId, 
  yswsId,
  apiKeyDisplay, 
  yswsName 
}: { 
  orgId: string; 
  yswsId: string | null;
  apiKeyDisplay: string | null; 
  yswsName?: string | null;
}) {
  const [revealed, setRevealed] = useState(false);
  const [state, formAction, pending] = useActionState(regenerateApiKeyAction, undefined);

  const [lastGeneratedKey, setLastGeneratedKey] = useState<string | null>(null);

  const shown = apiKeyDisplay ? (revealed ? "wom_" + apiKeyDisplay.padStart(4, "•") : "wom_" + "•".repeat(24)) : "";
  const fullKey = lastGeneratedKey;

  async function copy() {
    if (!fullKey) return;
    try {
      await navigator.clipboard.writeText(fullKey);
    } catch {
      // Clipboard API can be unavailable in non-secure contexts.
    }
  }

  const curl = fullKey 
    ? `curl -X POST https://<your-domain>/api/orders \\\n  -H "Authorization: Bearer ${fullKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"recipientName": "Jane Doe", "recipientEmail": "jane@example.com", "note": "Spring event"}'`
    : "Generate an API key first.";

  const script = fullKey
    ? `// On your YSWS shop checkout:
const key = "${fullKey}";

const res = await fetch("https://<your-domain>/api/orders", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${key}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    recipientName: "Jane Doe",
    recipientEmail: "jane@example.com",
    note: "Shop order"
  })
});
const json = await res.json();
console.log(json.order); // the created PASSPORT order`
    : "Generate an API key first.";

  const [tab, setTab] = useState<"curl" | "js">("curl");

  return (
    <div className="border-2 border-govuk-black bg-govuk-grey-1 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-sm">API integration</h3>
          <p className="text-xs text-govuk-grey-4 mt-0.5">
            Order passports from your YSWS shop. Each order requires a recipient.
          </p>
        </div>
        {yswsName && (
          <span className="govuk-tag govuk-tag--grey text-xs shrink-0 mt-1">
            {yswsName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 break-all border-2 border-govuk-black bg-govuk-white px-2 py-1.5 text-xs font-mono">
          {shown || "No key yet — generate one below."}
        </code>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          disabled={!apiKeyDisplay}
          className="govuk-button govuk-button--secondary govuk-button--small shrink-0"
        >
          {revealed ? "Hide" : "Reveal"}
        </button>
        <button
          type="button"
          onClick={copy}
          disabled={!fullKey}
          className="govuk-button govuk-button--secondary govuk-button--small shrink-0"
        >
          Copy
        </button>
      </div>

      <details className="border-t border-govuk-grey-2 pt-3">
        <summary className="cursor-pointer font-bold text-sm mb-2">Integration examples</summary>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setTab("curl")}
            className={`govuk-button govuk-button--secondary govuk-button--small ${
              tab === "curl" ? "" : "govuk-button--inactive"
            }`}
          >
            cURL
          </button>
          <button
            type="button"
            onClick={() => setTab("js")}
            className={`govuk-button govuk-button--secondary govuk-button--small ${
              tab === "js" ? "" : "govuk-button--inactive"
            }`}
          >
            JavaScript
          </button>
        </div>
        <pre className="overflow-x-auto border-2 border-govuk-black bg-govuk-black p-3 text-xs text-govuk-white">
          {tab === "curl" ? curl : script}
        </pre>
        <p className="mt-2 text-xs text-govuk-grey-4">
          You can also pass the key as an{" "}
          <code className="border border-govuk-grey-3 px-1">x-api-key</code> header.
        </p>
      </details>

      <form action={formAction} className="pt-2 border-t border-govuk-grey-2">
        <input type="hidden" name="orgId" value={orgId} />
        {yswsId && <input type="hidden" name="yswsId" value={yswsId} />}
        {state?.error && (
          <p role="alert" className="mb-2 border-l-4 border-hc-red px-2 py-1.5 font-semibold text-sm bg-govuk-grey-1">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="mb-2 border-l-4 border-govuk-green px-2 py-1.5 font-semibold text-sm bg-govuk-grey-1">
            {state.ok}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="govuk-button govuk-button--secondary govuk-button--small"
        >
          {pending ? "Regenerating..." : "Regenerate key"}
        </button>
      </form>
    </div>
  );
}