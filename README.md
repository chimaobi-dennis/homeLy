# HomeLy

Property management for the Nigerian rental market. Launch city: Enugu.

Next.js (App Router, TypeScript) + Supabase (Postgres, Auth, RLS). See
[CLAUDE.md](./CLAUDE.md) for the stack, role model, schema and conventions.

## Local setup

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and the
   [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
   (`brew install supabase/tap/supabase`).
2. `npm install`
3. `npm run db:start` — boots the local Supabase stack and applies
   `supabase/migrations` + `supabase/seed.sql`.
4. `cp .env.example .env.local` and fill it from `npm run db:status`.
5. `npm run dev` → http://localhost:3000

Local Studio: http://127.0.0.1:54323 · Local mail catcher: http://127.0.0.1:54324

### Local dev accounts (seeded, password `homely-dev-password`)

| Email                   | role_tags        |
|-------------------------|------------------|
| admin@homely.local      | admin            |
| staff@homely.local      | bd, inspector    |
| landlord@homely.local   | landlord         |

## Routes

| Route                    | Status                       |
|--------------------------|------------------------------|
| `/landlord/apply`        | placeholder (form TBD)       |
| `/staff/invite/[token]`  | placeholder (accept flow TBD)|
| `/waitlist`              | placeholder (anonymous form TBD) |
