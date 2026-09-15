-- HomeLy · migration 0002
-- profiles: one row per real auth account (admin, staff, landlord).
-- Tenants deliberately have NO auth account and therefore no profile row;
-- they live only in waitlist_entries.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  -- Role tags. A staff account may hold several at once, e.g. {bd,inspector}.
  role_tags   text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_role_tags_valid
    check (role_tags <@ array['admin', 'bd', 'inspector', 'landlord']::text[])
);

comment on table  public.profiles is 'One row per auth user. Tenants have no auth account and no profile.';
comment on column public.profiles.role_tags is 'Subset of {admin,bd,inspector,landlord}. Only changeable by an admin or the service role.';

create index profiles_role_tags_idx on public.profiles using gin (role_tags);

-- ---------------------------------------------------------------------------
-- Generic updated_at maintenance (reused by later tables)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helper functions used by RLS policies.
-- SECURITY DEFINER so a policy on `profiles` can consult `profiles` without
-- recursing into its own RLS. They only ever reveal the *caller's own* tags.
-- ---------------------------------------------------------------------------
create or replace function public.current_role_tags()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role_tags from public.profiles p where p.id = auth.uid()),
    '{}'::text[]
  );
$$;

create or replace function public.has_role(role_tag text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select role_tag = any (public.current_role_tags());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin');
$$;

-- bd, inspector or admin.
create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_role_tags() && array['admin', 'bd', 'inspector']::text[];
$$;

-- True for writers allowed to touch protected columns (status, role_tags, ...):
-- the service role, a direct DB connection (migrations / seeds / Studio SQL),
-- or an authenticated user holding the admin tag.
-- Deliberately SECURITY INVOKER so `current_user` is the *calling* DB role.
create or replace function public.is_privileged_writer()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('postgres', 'supabase_admin', 'service_role')
      or public.is_admin();
$$;

-- ---------------------------------------------------------------------------
-- Guard: role_tags may only be changed by an admin or the service role.
-- (Users can update their own profile row, but not promote themselves.)
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_role_tags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role_tags is distinct from old.role_tags
     and not public.is_privileged_writer() then
    raise exception 'profiles.role_tags can only be changed by an admin or the service role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role_tags
  before update on public.profiles
  for each row execute function public.protect_profile_role_tags();

-- ---------------------------------------------------------------------------
-- Auto-create a profile whenever an auth user is created.
--
-- role_tags come ONLY from raw_app_meta_data (settable solely through the
-- server-side Admin API / service role). raw_user_meta_data is client
-- controlled and is used for full_name only. A self-service sign-up with no
-- app_metadata role_tags becomes a landlord — the only self-service account
-- type. Admin and staff accounts are always created server-side.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tags text[];
begin
  if new.raw_app_meta_data ? 'role_tags' then
    select array_agg(value)
      into tags
      from jsonb_array_elements_text(new.raw_app_meta_data -> 'role_tags');
  end if;

  insert into public.profiles (id, full_name, role_tags)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    coalesce(tags, array['landlord']::text[])
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Privileges + Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;
grant all    on table public.profiles to service_role;

-- A user can read their own row.
create policy "profiles: user selects own row"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- Admins can read every profile.
create policy "profiles: admin selects all rows"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()));

-- A user can update their own row (role_tags guarded by trigger above).
create policy "profiles: user updates own row"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
