# Travel Organizer

A responsive web application for travelers and travel organizers to plan itineraries, coordinate tasks, collaborate, and track expenses in one place.

## MVP scope

- Trip itinerary and essential information
- Tasks with owners and deadlines
- Reminders and notifications
- Collaboration and comments
- Expense tracking

## Technology

- Next.js with the App Router
- TypeScript
- Tailwind CSS
- Vitest and Testing Library
- GitHub Actions

Supabase will provide PostgreSQL, authentication, authorization, and realtime capabilities as those features are introduced.

## Local development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Task reminder configuration

The daily Vercel cron calls `GET /api/cron/task-reminders` at 09:00 UTC. Configure these environment variables in the deployment:

- `CRON_SECRET`: secret used by Vercel to authorize cron requests.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase key used by the reminder worker.
- `RESEND_API_KEY`: API key for email delivery.
- `REMINDER_EMAIL_FROM`: verified sender, for example `Travel Organizer <reminders@example.com>`.
- `NEXT_PUBLIC_APP_URL`: public application URL used in reminder links.

Never expose the service-role or email-provider keys through `NEXT_PUBLIC_` variables. Delivery failures store only a technical failure code and reminder identifier, not private trip content.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

The same checks run in GitHub Actions for every pull request and push to `main`.

## Contribution workflow

1. Choose or create a GitHub Issue.
2. Create a branch from `main`.
3. Implement the smallest useful change and add relevant tests.
4. Open a pull request and complete the checklist.
5. Merge only after CI passes and the change is reviewed.

## Planned project structure

```text
src/
  app/          # Routes, layouts, and pages
  components/   # Shared UI components
  features/     # Domain modules: trips, itinerary, tasks, expenses, comments
  lib/          # Integrations, validation, and shared utilities
```
