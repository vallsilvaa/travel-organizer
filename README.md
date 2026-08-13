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

## Supabase development

The repository includes the Supabase CLI, local configuration, and versioned migrations.

```bash
npm install
npm run supabase:start
cp .env.example .env.local
npm run dev
```

After Supabase starts, copy its API URL and publishable key into `.env.local`. Local, hosted development, and production are separate environments; do not link production for routine development.

Database commands:

- `npm run db:diff -- change_name` captures local schema changes.
- `npm run db:reset` rebuilds the local database from migrations.
- `npm run db:push` applies committed migrations to a deliberately linked hosted project.
- `npm run supabase:status` shows local services and credentials.

Never commit real credentials or edit a migration that has already been applied. CI intentionally builds without Supabase credentials.

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
