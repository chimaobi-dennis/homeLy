-- HomeLy · migration 0005
-- staff_invites: admin-issued invitations for bd / inspector accounts.
-- Admin-only table. No other role can read it at all; the public
-- /staff/invite/[token] page must resolve tokens server-side (service role or a
-- future SECURITY DEFINER RPC), never by selecting from this table as anon.

create table public.staff_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (position('@' in email) > 1),
  role_tags   text[] not null
              check (role_tags <@ array['bd', 'inspector']::text[] and cardinality(role_tags) > 0),
  invited_by  uuid references public.profiles (id) on delete set null,
  -- 64 hex chars from 32 random bytes; generated in the DB so it is never weak.
  token       text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  status      public.staff_invite_status not null default 'pending',
  expires_at  timestamptz not null default now() + interval '7 days',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  public.staff_invites is 'Admin-only. Invites for staff (bd / inspector) accounts.';
comment on column public.staff_invites.token is 'Opaque single-use token embedded in the invite link.';

create index staff_invites_email_idx on public.staff_invites (lower(email));
create index staff_invites_status_idx on public.staff_invites (status);

create trigger staff_invites_set_updated_at
  before update on public.staff_invites
  for each row execute function public.set_updated_at();

-- TODO(resend): sending the invite email will hook in here (server-side).

-- ---------------------------------------------------------------------------
-- Privileges + Row-Level Security (admin only; no delete via API at all)
-- ---------------------------------------------------------------------------
alter table public.staff_invites enable row level security;

revoke all on table public.staff_invites from anon, authenticated;
grant select, insert, update on table public.staff_invites to authenticated;
grant all on table public.staff_invites to service_role;

create policy "staff_invites: admin selects"
  on public.staff_invites for select
  to authenticated
  using ((select public.is_admin()));

create policy "staff_invites: admin inserts"
  on public.staff_invites for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "staff_invites: admin updates"
  on public.staff_invites for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
