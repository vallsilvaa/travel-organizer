# Travel Organizer

A responsive web application for travelers and travel organizers to plan trips together.

## Local development

Requirements: Node.js 20 or newer, npm, Docker, and the Supabase CLI installed through this repository.

```bash
npm install
npm run supabase:start
cp .env.example .env.local
npm run dev
```

After Supabase starts, copy its API URL and publishable key into `.env.local`. Never commit real credentials; `.env.local` and other `.env.*` files are ignored.

The local Supabase stack is separate from hosted development and production projects. Link a hosted development project only when needed with `npx supabase link`, then apply versioned migrations with `npm run db:push`. Do not link production for routine development.

## Database workflow

- Create schema changes locally, then capture them with `npm run db:diff -- change_name`.
- Rebuild the local database from migrations with `npm run db:reset`.
- Check local services and credentials with `npm run supabase:status`.
- Commit every file under `supabase/migrations/`; never edit an already-applied migration.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

CI intentionally runs without Supabase credentials. The shared client reads environment variables only when instantiated, so lint, tests, and production builds do not need hosted secrets.
