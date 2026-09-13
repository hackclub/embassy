import type { EmailSendOptions } from "../send";

const MAILPIT_API = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

export async function sendMailpit(
  opts: EmailSendOptions
): Promise<{ id: string }> {
  const res = await fetch(`${MAILPIT_API}/api/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: { Email: process.env.EMAIL_FROM ?? "noreply@embassy.local" },
      To: [{ Email: opts.to }],
      Subject: opts.subject,
      HTML: opts.html,
      Text: opts.text,
    }),
  });
  if (!res.ok) throw new Error(`Mailpit send failed: ${res.status}`);
  return { id: `mailpit-${Date.now()}` };
}
