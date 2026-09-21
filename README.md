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

| Route                     | Status                                                     |
|---------------------------|------------------------------------------------------------|
| `/landlord/apply`         | trust-first landing (fees, process, maintenance disclosure) |
| `/landlord/apply/form`    | application wizard + document upload                        |
| `/landlord/dashboard`     | landlord status view, resubmit paths                        |
| `/login`                  | email + password sign-in for all roles                      |
| `/admin/landlords`        | admin-only review list / detail (KYC, agreement, property)  |
| `/admin/waitlist`         | queue: staff read-only; admin invites entries to convert    |
| `/admin/tenants`          | admin-only tenant KYC review (verify / reject)              |
| `/waitlist/convert/[token]` | public: accept a conversion invite → tenant account        |
| `/tenant`                 | signed-in tenant status, ID upload, resubmit                |
| `/admin/staff`            | admin-only: invite staff, revoke invites, deactivate staff  |
| `/waitlist`               | public Stage 1 priority-list form (no account)              |
| `/staff/invite/[token]`   | public invite acceptance (set password, signs in)           |

Notifications, the Flowmono e-signature call and Dojah KYC are stubs: set nothing and watch the
dev server console for `[notify STUB]` / `[flowmono STUB]` / `[dojah STUB]` lines. Staff invite links are also shown on `/admin/staff` after creation.
