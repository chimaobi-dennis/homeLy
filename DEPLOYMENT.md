# HomeLy — deployment runbook (GitHub → Supabase Cloud → Vercel)

First production deploy of the state committed at `b76c687` (Steps 1–5).
Nothing in the app changes here: this is repo hosting, a cloud database and a
public URL. Everything still stubbed stays stubbed (§7).

Run every command from the repo root. Steps are ordered — Vercel's build fails
without the Supabase keys, so Supabase comes first.

---

## 1. Prerequisites (once)

```bash
brew install supabase/tap/supabase      # if not already installed
npm i -g vercel                         # Vercel CLI
gh --version || brew install gh         # optional, only for `gh repo create`
```

You also need: a GitHub account with push access to
`chimaobi-dennis/homeLy`, a Supabase account, a Vercel account.

---

## 2. Push to GitHub

This repo has no remote yet. Create the GitHub repo empty (no README, no
.gitignore — this repo has both), then:

```bash
rm -f .git/index.lock                    # stale lock, see the note below
git remote add origin https://github.com/chimaobi-dennis/homeLy.git
git add -A && git commit -m "Step 6 infra: deployment runbook, cloud scripts, Vercel region"
git push -u origin main
```

`gh repo create chimaobi-dennis/homeLy --private --source . --push` does the
create and the push in one go if you have the GitHub CLI.

> **Stale `.git/index.lock`.** A `git status` run from an environment without
> delete permission left an empty lock file behind. Git refuses to stage or
> commit while it exists; `rm -f .git/index.lock` clears it. Nothing in the repo
> was modified by it.

Check before pushing that no secrets are tracked — `.env.local` is gitignored
and must stay that way:

```bash
git ls-files | grep -E '\.env' && echo "STOP: env file tracked" || echo "clean"
```

Branch policy: `main` is the production branch. Vercel deploys every push to
`main` to production and every other branch to a preview URL.

---

## 3. Supabase cloud project

### 3.1 Create it

Dashboard → New project.

- **Name:** `homely-prod`
- **Region:** `West EU (London) eu-west-2` — lowest latency to Nigeria of the
  available regions, and close to UK diaspora landlords. Pick the same region
  for Vercel functions in §4.
- **Database password:** generate a strong one and store it in your password
  manager. You need it for `db push`.

CLI alternative:

```bash
supabase login
supabase projects list                  # find your org id
supabase projects create homely-prod --org-id <org-id> --region eu-west-2 --db-password '<pw>'
```

### 3.2 Apply the schema

```bash
supabase link --project-ref <project-ref>     # ref is in the dashboard URL
supabase db push                              # applies all 15 migrations, in order
```

`supabase/seed.sql` is **not** run by `db push` — production starts with an
empty `auth.users`. The first admin is created by hand in §6.

### 3.3 Verify the push landed

Dashboard → SQL editor:

```sql
-- 15 migrations
select count(*) from supabase_migrations.schema_migrations;

-- both private buckets exist
select id, public, file_size_limit from storage.buckets order by id;

-- storage policies survived the push (6 expected: 3 landlord, 3 tenant)
select policyname from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by policyname;

-- RLS on everywhere
select relname, relrowsecurity from pg_class
 where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname;
```

If a `create policy ... on storage.objects` statement was refused during push
(permissions on the storage schema differ from local), copy those statements out
of `supabase/migrations/20260915100300_landlord_documents.sql` and
`20260921000100_tenants_and_queue_conversion.sql` and run them in the SQL editor
as `postgres`. Do **not** edit the applied migration files.

### 3.4 Regenerate types against the cloud project (should be a no-op)

```bash
npm run db:types:linked
git diff --stat src/lib/supabase/database.types.ts     # expect: no change
```

A non-empty diff means local and cloud schemas disagree — resolve that before
deploying.

### 3.5 Copy the keys

Project Settings → API keys:

| Dashboard value | Env var |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key (`sb_publishable_…`, or legacy `anon`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key (`sb_secret_…`, or legacy `service_role`) | `SUPABASE_SECRET_KEY` |

The secret key bypasses RLS. It goes into Vercel only, never into a
`NEXT_PUBLIC_*` name, never into git.

---

## 4. Vercel

```bash
vercel login
vercel link                    # link this directory to a Vercel project
```

Set env vars **before the first build** — `src/lib/supabase/env.ts` throws on a
missing variable and prerendering will fail:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_SECRET_KEY production
vercel env add NEXT_PUBLIC_SITE_URL production        # https://<your-prod-domain>

# Previews need the connection too. Leave NEXT_PUBLIC_SITE_URL unset for
# previews on purpose: src/lib/site-url.ts then derives the origin from the
# request, so invite links point at the preview domain instead of production.
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY preview
vercel env add SUPABASE_SECRET_KEY preview
```

Preview deployments share the production database. Until there is a staging
Supabase project, treat preview URLs as production: anything you do there is
real data.

Deploy:

```bash
vercel --prod
```

Function region is pinned to `lhr1` in `vercel.json` to sit next to a London
Supabase project. Change both together if you move either.

---

## 5. Supabase Auth settings (dashboard, after the domain exists)

Authentication → URL configuration:

- **Site URL:** `https://<your-prod-domain>`
- **Redirect URLs:** `https://<your-prod-domain>/**` and, if you want auth to
  work on previews, `https://homely-*-<your-vercel-scope>.vercel.app/**`

Authentication → Providers → Email:

- **Confirm email:** local dev has this **off**, which is what Steps 2–5 were
  tested against. Hosted projects default to **on**.
  - Leaving it **on**: landlord sign-up (`/landlord/apply/form`) creates the
    account but returns no session, and the UI shows "confirm your email". The
    confirmation mail comes from Supabase's built-in service, which is rate
    limited to a handful per hour and explicitly not for production. Staff and
    tenant invites are unaffected — they use the Admin API with
    `email_confirm: true`.
  - Turning it **off** matches the tested behaviour and gets landlords straight
    in. The cost is that landlord email addresses are unverified until Resend is
    wired up. This is the same verification gap already flagged for waitlist
    entries.
  - Either way, configure **custom SMTP** (Resend, once
    `RESEND_API_KEY` is live) before the first real landlord signs up.
- **Minimum password length:** set to **8**, matching the app's own validation.

---

## 6. Create the first production admin

`seed.sql` never runs against cloud, so production has no accounts.

1. Authentication → Users → **Add user** → email + a strong password, with
   "Auto confirm user" checked.
2. SQL editor — grant the admin tag (`profiles.role_tags` mirrors
   `auth.users.raw_app_meta_data.role_tags` via the
   `on_auth_user_app_metadata_updated` trigger):

```sql
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                           || '{"role_tags":["admin"]}'::jsonb
 where email = '<your-admin-email>';

-- verify the mirror fired
select u.email, p.role_tags
  from public.profiles p join auth.users u on u.id = p.id;
```

3. Sign in at `https://<your-prod-domain>/login` and confirm `/admin` loads.

Staff accounts are then created the normal way, from `/admin/staff` — the invite
URL is shown on the page, since email sending is still a stub. Copy it and send
it over WhatsApp.

---

## 7. Post-deploy smoke test

Against the production URL, in this order:

1. `/` — both persona views render, no console errors.
2. `/waitlist` — submit an entry; it appears in `/admin/waitlist`.
3. `/admin/staff` — invite a staff email, open the invite link in a private
   window, set a password, land signed in with the right role tags.
4. `/landlord/apply/form` — create a landlord account, submit an application,
   upload ID + proof of ownership; confirm the files are only reachable through
   a signed URL, and `/admin/landlords` shows them.
5. `/admin/waitlist` — invite your waitlist entry to convert; accept at
   `/waitlist/convert/[token]`, upload an ID, submit; verify in
   `/admin/tenants`; confirm `/tenant` shows "Verified, active queue member".
6. Delete the test rows afterwards, or accept them as production data.

---

## 8. What is still a stub after this deploy

Unchanged by deployment — all of these log instead of acting:

- **Email / SMS / WhatsApp** — `notifyByEmail()` logs. On Vercel those lines go
  to the function logs (Vercel → Project → Logs), not a terminal. Invite links
  must be copied from the admin pages.
- **Dojah KYC** — landlord and tenant KYC stay manual admin review.
- **Flowmono e-signature** — `sendAgreementForSigning()` is a stub.
- **Payments** (Monnify / Flutterwave / Anchor) — not built.
- **PostHog** — not integrated.

Also outstanding, and not code problems: CAC incorporation (gates the KYB for
every payment/KYC vendor), and the Enugu 2025 Tenancy Bill status.

---

## 9. Rollback

- **App:** Vercel → Deployments → previous deployment → Promote to Production.
- **Schema:** there is no `down` migration. A bad migration is fixed by writing
  a new forward migration and pushing it. Take a backup (Database → Backups)
  before any destructive change.
