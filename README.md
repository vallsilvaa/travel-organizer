# Travel Organizer

A collaborative web application for planning trips: itinerary, reservations,
pre-trip prep tasks, shared expenses, documents, and organizer invitations,
all scoped per trip with row-level security in Postgres.

Live at [travel-organizer-zeta.vercel.app](https://travel-organizer-zeta.vercel.app).

## Features

- **Trips** — create/edit/archive/delete, with a per-trip IANA timezone that
  drives status, task deadlines, and calendar exports.
- **Itinerary** — dated/timed items, exportable as a `.ics` calendar file
  with the trip's own timezone attached to each event.
- **Reservations** — flights, lodging, and transport, with masked
  confirmation codes.
- **Pre-trip preparation** — tasks with owners, due dates, categories, and a
  critical flag; trips to England/UK auto-seed a ~24-item checklist.
- **Expenses** — shared costs with equal or custom splits, per-currency
  balances, and settle-up suggestions.
- **Documents** — file attachments (PDF/JPEG/PNG/WEBP/HEIC, up to 10 MB)
  optionally linked to a specific itinerary item, task, or reservation.
- **Comments** — threaded on itinerary items and tasks.
- **Collaboration** — email invitations (7-day expiry, resend/cancel),
  multi-organizer trips, and a realtime connection-status indicator.
- **Notifications** — in-app notification center plus daily email reminders
  for upcoming task deadlines (opt-out per user).
- **Appearance** — light/dark/system theme, persisted per browser.
- **Internationalization** — Portuguese and English, switchable per user via
  a cookie (no URL prefix, so trip invite links and calendar exports are
  locale-independent); powered by [next-intl](https://next-intl.dev).
- **Production monitoring** — Sentry error tracking with release context and
  cron monitoring, plus a `/api/health` endpoint for Supabase and the
  reminder service.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack, Server Actions)
- TypeScript
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) on
  [Base UI](https://base-ui.com) primitives
- [Supabase](https://supabase.com) — Postgres, Auth, Storage, Realtime, all
  authorized through row-level security (see
  [`docs/security/rls-audit.md`](docs/security/rls-audit.md))
- [Resend](https://resend.com) for transactional email
- [Sentry](https://sentry.io) for error monitoring (see
  [`docs/operations/incident-investigation.md`](docs/operations/incident-investigation.md))
- Vitest + Testing Library (unit/component), Playwright + axe-core (e2e and
  accessibility)
- Deployed on [Vercel](https://vercel.com)

## Project structure

```text
src/
  app/          # Routes, layouts, and API routes (App Router)
    api/            # /api/cron/task-reminders, /api/health, /api/trips/[id]/itinerary.ics
    auth/            # sign-in, sign-up, forgot/reset password, callback
    dashboard/       # trip list, search/filter/sort, profile, invitations
    trips/[tripId]/  # trip detail: itinerary, reservations, tasks, expenses, docs, organizer
  components/   # Shared UI: shadcn primitives (ui/), theme toggle, confirm-delete dialog, etc.
  features/     # One module per domain, each with actions.ts, validation.ts, and tests:
    attachments/ auth/ comments/ expenses/ invitations/ itinerary/
    notifications/ participants/ realtime/ reminders/ reservations/ tasks/ trips/
  i18n/         # next-intl request config, locale cookie helpers, setLocale action
  lib/          # Supabase clients (server/client/proxy), timezone helpers, cn()
  messages/     # pt.json / en.json translation catalogs
supabase/
  migrations/   # SQL migrations (schema, RLS policies, RPCs)
  tests/        # pgTAP RLS authorization tests
e2e/            # Playwright end-to-end and accessibility specs
docs/
  security/     # RLS authorization audit
  operations/   # Incident investigation workflow
```

## Local development

Requirements: Node.js 22+ (CI and production run Node 22; Node 20 works but
`@supabase/supabase-js` prints deprecation warnings), npm, and Docker
(only needed to run Supabase locally for real auth/data or the e2e suite).

```bash
npm install
cp .env.example .env.local   # points at local Supabase defaults
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without a running local
Supabase instance, pages that require auth/data will fail — start one with
`npm run supabase:start` (see below) if you need real sign-up/sign-in.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project connection (client + server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by the reminder cron to bypass RLS |
| `RESEND_API_KEY`, `REMINDER_EMAIL_FROM` | Transactional email for invitations and task reminders |
| `CRON_SECRET` | Authorizes Vercel's call to `/api/cron/task-reminders` and `/api/cron/overdue-tasks` |
| `NEXT_PUBLIC_APP_URL` | Public base URL used in email links and calendar exports |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push (server-side signing). Generate a pair with `npx web-push generate-vapid-keys` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Same value as `VAPID_PUBLIC_KEY`, exposed to the browser for `pushManager.subscribe()` |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Sentry error reporting (server and client) |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Build-time only, for source map upload — not needed for local dev |

Never expose the service-role key, Resend key, or Sentry auth token through
`NEXT_PUBLIC_` variables. Reminder delivery failures are logged with only a
technical failure code and delivery ID, never trip content or recipient
email (see the incident-investigation doc).

### Database and migrations

```bash
npm run supabase:start   # starts local Supabase (requires Docker)
npm run db:reset         # (re)applies every migration to the local database
npm run supabase:stop
```

Create a new migration with `npm run db:diff -- <name>` or by hand under
`supabase/migrations/`. Migrations are applied to production explicitly with
`npm run db:push` against the linked project — pushing to `main` does **not**
apply them automatically.

## Quality checks

```bash
npm run lint
npm test           # unit/component tests (Vitest)
npm run build
npm run test:db     # pgTAP RLS tests, requires local Supabase running
npm run test:e2e    # Playwright, requires local Supabase running (see e2e/README.md)
```

The same checks (`lint`, `test`, `build`, then `test:db` + `test:e2e` against
a fresh local Supabase instance) run in GitHub Actions for every pull request
and push to `main`.

## Deployment

Production runs on Vercel, but automatic deploy-on-push is disabled
(`vercel.json` sets `git.deploymentEnabled: false`) since database
migrations must be pushed to Supabase explicitly and in order with the code
that depends on them. To ship a change once its PR is merged to `main`:

```bash
npm run db:push        # apply any new migrations to production first
vercel deploy --prod
```

Then confirm `/api/health` returns `{"status":"ok"}` and check Sentry/Vercel
runtime logs for errors.

## Contribution workflow

1. Choose or create a GitHub Issue.
2. Create a branch from `main` (e.g. `agent/<short-description>`).
3. Implement the smallest useful change and add relevant tests.
4. Open a pull request and complete the checklist.
5. Merge only after CI passes and the change is reviewed.
