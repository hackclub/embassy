# Hack Club Embassy

Formerly **whoami** — build identity-related software, earn a Hack Club Passport.

<img width="1663" height="1683" alt="image" src="https://github.com/user-attachments/assets/d6d7a328-7f19-4a9f-bf16-8dbc2b714bbb" />

## Stack

Next.js 16 (App Router, `proxy.ts`) · Auth.js v5 (Hack Club OIDC) · Prisma 7 + Postgres ·
Redis (rate limiting + feedback) · Sentry (browser/server) · Airtable (one-way mirror) ·
pino · Tailwind 4. Runtime is **Bun**.

## Local dev

```bash
cp .env.example .env          # fill in secrets
docker compose up -d postgres redis   # :5566 / :6379, bound to localhost only
bun install
bunx prisma migrate dev       # or migrate deploy against an existing volume
bun run dev
```

Auth needs a Hack Club OIDC app; `ADMIN_BYPASS=true` (see `.env.example`) opens every
page without sign-in for local testing only — boot is **refused in production** with it
set. `ADMIN_BYPASS_HOURS` fakes Hackatime hours for the dev-admin account.

## Environment variables

| Var | Purpose | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Postgres (pg adapter) | required |
| `REDIS_URL` | Redis/Valkey | default `redis://127.0.0.1:6379`; if down, rate limiting **fails open** |
| `AUTH_SECRET` | Auth.js JWT signing | ≥32 chars; `openssl rand -base64 32` |
| `AUTH_URL` | Canonical origin | used for OAuth callbacks + email links |
| `AUTH_HCA_CLIENT_ID` / `AUTH_HCA_CLIENT_SECRET` | Hack Club OIDC | required |
| `AUTH_HACKATIME_CLIENT_ID` / `_SECRET` | Hackatime link | leave `placeholder` to disable that flow |
| `PII_ENCRYPTION_KEY` | AES-GCM key (base64, 16/24/32 bytes) | required before any recipient submit |
| `SUPERADMIN_EMAILS` | Bootstrap superadmin | grants role when DB role is still `PARTICIPANT` |
| `SENTRY_DSN` | Server SDK | browser uses `NEXT_PUBLIC_SENTRY_DSN` |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Source maps | build-time only; empty = skipped |
| `AIRTABLE_API_KEY` / `AIRTABLE_BASE_ID` | Mirror target | token needs `schema` scope (creates tables) |
| `EMAIL_PROVIDER` / `MAILPIT_URL` / `EMAIL_FROM` / `LOOPS_API_KEY` | Email | `mailpit` (dev) or `loops` |
| `FEATURE_EMAIL` / `FEATURE_AIRTABLE` | Enable side effects | both default off |
| `FEATURE_RECIPIENT` | Public intake form | default on; off ⇒ `/recipient/*` → `/track/*` |

At startup, `instrumentation.ts` runs env validation (`lib/env.ts`): it **throws in
production** on bad/missing required vars or production `ADMIN_BYPASS`, and warns in dev.

## Commands

```bash
bun run dev            # next dev (turbopack)
bun run build          # standalone build (withSentryConfig wraps it)
bun run start          # serve the build
bun run lint
bun test               # bun's test runner
bun run sync:airtable  # one-way Postgres → Airtable mirror
bun run email:queue    # flush pending/failed email deliveries
```

### Airtable mirror (`lib/airtable-sync.ts`)

One-way Postgres → Airtable. Creates/updates/prunes these tables by stable DB `id`
(auto-creates tables via the meta API): **Orgs, YSWSes, Users, Orders, Shop Items, Shop
Orders, Submissions, Credit Transactions, Order Events, Shipments, Email Deliveries**.

Never mirrored (stays in Postgres): recipient bearer tokens, YSWS API key
hash/prefix/scope/expiry, Hackatime tokens, encrypted recipient PII, NextAuth
accounts/sessions, audit logs. A table is only pruned when the source query returns rows,
so a broken read can't wipe an Airtable table. Requires `FEATURE_AIRTABLE=true` + creds;
empty DB tables are skipped. Run it manually from `/admin` → *Airtable mirror → Sync now*,
or on a timer:

```cron
*/15 * * * * cd /srv/embassy && bun run sync:airtable >> /var/log/embassy-sync.log 2>&1
*/5  * * * * cd /srv/embassy && bun run email:queue   >> /var/log/embassy-mail.log  2>&1
```

### Email

`FEATURE_EMAIL=true` + a provider (`mailpit` for dev via `MAILPIT_URL`, `loops` for prod).
`deliverOrderEmail` sends order-created / details-received / shipped / delivered notices
(HTML is escaped server-side; shipped/delivered fire at most once per order). If sending
is off, deliveries are recorded as `pending` and picked up by `bun run email:queue`.

## Security notes

- Rate limiting (`lib/rate-limit.ts`, sliding window in Redis) on sign-in, orders API,
  recipient actions, and feedback. Client identity uses the **rightmost** `x-forwarded-for`
  hop, so run behind a proxy that overwrites the header (Caddy does).
- Security headers (CSP, HSTS, `X-Frame-Options`, …) are owned by the Caddy edge proxy in
  production — see `infra/nix/services.nix`; they are intentionally *not* set in
  `next.config.ts` to avoid double-application.
- Server actions get Next.js origin checking; `allowedOrigins` is not widened.
- Sentry scrubs PII in `beforeSend` (emails, `wom_` keys, token-shaped strings) and strips
  cookies/IP by default; user context is ID-only.
