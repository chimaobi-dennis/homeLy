-- HomeLy · migration 0006
-- waitlist_entries: anonymous tenant waitlist. Tenants have NO auth account at
-- this stage — this is deliberate. Anyone (anon or signed-in) may INSERT
-- name / whatsapp_number / email only; reading is staff + admin only; there is
-- no client-side UPDATE or DELETE at all (service role only).

create table public.waitlist_entries (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(btrim(name)) between 1 and 120),
  whatsapp_number     text not null check (whatsapp_number ~ '^\+?[0-9][0-9 ()-]{5,19}$'),
  email               text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  joined_at           timestamptz not null default now(),
  email_confirmed     boolean not null default false,
  whatsapp_confirmed  boolean not null default false,
  conversion_status   public.waitlist_conversion_status not null default 'waitlist'
);

comment on table public.waitlist_entries is 'Public tenant waitlist. Insert-only for the public; read by staff/admin; updates via service role only.';

create index waitlist_entries_email_idx on public.waitlist_entries (lower(email));
create index waitlist_entries_conversion_status_idx on public.waitlist_entries (conversion_status);

-- TODO(resend):  email confirmation → sets email_confirmed via service role.
-- TODO(termii):  WhatsApp/SMS confirmation → sets whatsapp_confirmed via service role.

-- ---------------------------------------------------------------------------
-- Privileges + Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.waitlist_entries enable row level security;

revoke all on table public.waitlist_entries from anon, authenticated;

-- Column-level INSERT grant: the public can supply ONLY these three columns.
-- Every other column (confirmed flags, conversion_status, joined_at, id) comes
-- from its default and cannot be set by the caller.
grant insert (name, whatsapp_number, email) on table public.waitlist_entries to anon, authenticated;

-- Reading is possible for signed-in users but RLS below narrows it to staff/admin.
grant select on table public.waitlist_entries to authenticated;

grant all on table public.waitlist_entries to service_role;

create policy "waitlist_entries: public inserts"
  on public.waitlist_entries for insert
  to anon, authenticated
  with check (true);

create policy "waitlist_entries: staff and admin select"
  on public.waitlist_entries for select
  to authenticated
  using ((select public.is_staff_or_admin()));

-- Intentionally no UPDATE / DELETE policies: only the service role may change
-- confirmation flags or conversion_status.
