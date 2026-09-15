-- HomeLy · migration 0004
-- properties: units a landlord submits for management / listing.

create table public.properties (
  id                         uuid primary key default gen_random_uuid(),
  landlord_id                uuid not null references public.landlords (id) on delete cascade,
  address                    text not null,
  city                       text not null default 'Enugu',
  bedrooms                   integer not null check (bedrooms >= 0),
  target_annual_rent         numeric not null check (target_annual_rent >= 0),
  maintenance_threshold_ngn  numeric not null default 150000 check (maintenance_threshold_ngn >= 0),
  status                     public.property_status not null default 'submitted',
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

comment on table  public.properties is 'Landlord-submitted properties. status is admin/service-role writable only.';
comment on column public.properties.target_annual_rent is 'Landlord''s target annual rent in NGN.';
comment on column public.properties.maintenance_threshold_ngn is 'Repairs at or below this NGN amount can be approved without landlord sign-off.';

create index properties_landlord_id_idx on public.properties (landlord_id);
create index properties_status_idx on public.properties (status);

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guard: status is never client-writable (admin / service role only).
-- ---------------------------------------------------------------------------
create or replace function public.guard_property_protected_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'submitted' then
      raise exception 'properties.status can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      raise exception 'properties.status can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.landlord_id is distinct from old.landlord_id then
      raise exception 'properties.landlord_id can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger properties_guard_protected_columns
  before insert or update on public.properties
  for each row execute function public.guard_property_protected_columns();

-- ---------------------------------------------------------------------------
-- Privileges + Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.properties enable row level security;

revoke all on table public.properties from anon, authenticated;
grant select, insert, update on table public.properties to authenticated;
grant all on table public.properties to service_role;

-- A landlord can read their own properties.
create policy "properties: landlord selects own rows"
  on public.properties for select
  to authenticated
  using ((select auth.uid()) = landlord_id);

-- Staff (bd / inspector) and admin can read every property.
create policy "properties: staff and admin select all rows"
  on public.properties for select
  to authenticated
  using ((select public.is_staff_or_admin()));

-- A landlord can submit properties under their own landlord row.
create policy "properties: landlord inserts own rows"
  on public.properties for insert
  to authenticated
  with check ((select auth.uid()) = landlord_id and (select public.has_role('landlord')));

-- A landlord can update their own properties (status guarded by trigger).
create policy "properties: landlord updates own rows"
  on public.properties for update
  to authenticated
  using ((select auth.uid()) = landlord_id)
  with check ((select auth.uid()) = landlord_id);

-- Admin can insert / update any property (including status).
create policy "properties: admin inserts any row"
  on public.properties for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "properties: admin updates any row"
  on public.properties for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
