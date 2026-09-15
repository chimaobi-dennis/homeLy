@AGENTS.md

# HomeLy — project guide for Claude

HomeLy is a property-management platform for the Nigerian rental market.
Launch city: **Enugu**. Owner / admin: Chimaobi Dennis (IGSOFT Web).

## Tech stack

- **Next.js** (App Router, TypeScript, `src/` layout, Tailwind v4). Next 16 —
  the `proxy.ts` convention replaces `middleware.ts`; `params` / `searchParams`
  are Promises. Read `node_modules/next/dist/docs/` when unsure.
- **Supabase**: Postgres + Auth (email + password) + Row-Level Security.
  - `@supabase/supabase-js` + `@supabase/ssr` (cookie-based sessions).
  - Client helpers in `src/lib/supabase/`: `client.ts` (browser),
    `server.ts` (Server Components / Actions / Route Handlers),
    `admin.ts` (service role — bypasses RLS, server-only, use sparingly).
  - `src/proxy.ts` refreshes the auth session on every request.
- **Supabase CLI for local dev.** There is no cloud project yet. Schema lives in
  `supabase/migrations/*.sql` — never run ad-hoc SQL by hand; write a migration.
  Migrations must stay clean enough for `supabase db push` to a cloud project.
  `supabase/seed.sql` is LOCAL ONLY (dev accounts) and never runs on push.

### Commands

```bash
npm run db:start     # supabase start (needs Docker Desktop running)
npm run db:reset     # re-apply all migrations + seed.sql from scratch
npm run db:types     # regenerate src/lib/supabase/database.types.ts — run after every migration
npm run db:test      # RLS regression suite (supabase/tests/rls.sql), rolls back; needs docker on PATH
npm run db:status    # prints local URL + keys for .env.local
npm run dev          # Next.js dev server on http://localhost:3000
npm run typecheck && npm run lint && npm run build
```

New migration: `supabase migration new <name>` (or hand-create
`supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`), then `npm run db:reset && npm run db:types`.

## Role model

Three kinds of **real auth accounts** (Supabase Auth, email + password):

| Kind     | `profiles.role_tags`                 | Created by                                   |
|----------|--------------------------------------|----------------------------------------------|
| admin    | `{admin}`                            | server-side only (Admin API / seed)          |
| staff    | `{bd}`, `{inspector}` or `{bd,inspector}` — ONE account can hold both | admin invite (`staff_invites`) → server-side |
| landlord | `{landlord}`                         | self-service sign-up (`/landlord/apply`)     |

- `bd` and `inspector` are **tags on one staff account**, not separate account types.
- **Tenants have NO auth account.** The waitlist (`/waitlist`) is anonymous —
  public INSERT into `waitlist_entries`, no login. This is deliberate. Do not
  add tenant auth unless explicitly asked.
- `role_tags` are set from `auth.users.raw_app_meta_data.role_tags` by the
  `on_auth_user_created` trigger (app_metadata is only settable server-side).
  A sign-up with no app_metadata tags becomes `{landlord}`. Only an admin or
  the service role can change `role_tags` afterwards (trigger-enforced).
- Postgres helpers used by RLS: `is_admin()`, `is_staff_or_admin()`,
  `has_role(tag)`, `current_role_tags()`, `is_privileged_writer()`.
  TypeScript mirror: `src/lib/roles.ts`.

## Schema (see `supabase/migrations/` for the source of truth)

- `profiles` — id → auth.users, full_name, role_tags[]
- `landlords` — id → profiles, country_of_residence, status
  (applied | kyc_pending | kyc_verified | kyc_rejected), assigned_ops_contact → profiles
- `properties` — landlord_id → landlords, address, city (default Enugu), bedrooms,
  target_annual_rent, maintenance_threshold_ngn (default 150000), status
  (submitted | under_inspection | listed | rejected)
- `staff_invites` — email, role_tags[] (bd/inspector), invited_by → profiles,
  token (unique, DB-generated), status (pending | accepted | revoked | expired), expires_at
- `waitlist_entries` — name, whatsapp_number, email, joined_at, email_confirmed,
  whatsapp_confirmed, conversion_status (waitlist | invited_to_convert | kyc_pending | active_queue)

## RLS rules (every table has RLS enabled; policies live next to each table's migration)

- `profiles`: own row select/update; admin selects all. `role_tags` change → admin/service only.
- `landlords`: landlord selects/updates own row, may insert own row (status forced
  to `applied`); staff+admin select all; admin inserts/updates any.
  `status` and `assigned_ops_contact` → admin/service role only (trigger).
- `properties`: same shape keyed on `landlord_id`; `status` → admin/service only.
- `staff_invites`: admin-only select/insert/update. Nobody else can read it —
  the public invite page must resolve tokens server-side.
- `waitlist_entries`: anon + authenticated may INSERT only `name, whatsapp_number,
  email` (column-level grant); staff+admin select; no client UPDATE/DELETE.
- "Protected" columns are enforced by BEFORE triggers that call
  `is_privileged_writer()` — so the service role, direct DB connections and
  admin users pass; everyone else gets `42501`.

## Integrations — NOT built yet

Dojah (KYC), Monnify / Flutterwave (payments), Termii (SMS/WhatsApp),
Resend (email), Flowmono (e-signature). Only `TODO(<vendor>)` comments mark
where they will plug in. Do not add integration code unless asked.

## Standing rules for Claude

1. **End every session with a full plain-text summary** of every file created or
   changed and every decision made — even if not asked for that turn. Include
   every migration and RLS policy touched, and flag anything guessed instead of
   silently assuming.
2. Schema changes go in a new migration file, never by editing an applied one
   and never by ad-hoc SQL. Regenerate types afterwards.
3. Never weaken an RLS policy or grant to "make something work" — fix the query
   or use the service role in trusted server code.
4. Never send real emails/SMS/WhatsApp from tests or local dev.
5. Keep tenants account-less unless the owner explicitly changes that decision.
