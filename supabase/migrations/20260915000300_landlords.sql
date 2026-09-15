-- HomeLy · migration 0003
-- landlords: extension of a profile for landlord accounts.

create table public.landlords (
  id                    uuid primary key references public.profiles (id) on delete cascade,
  country_of_residence  text,
  status                public.landlord_status not null default 'applied',
  -- Staff member responsible for this landlord (a profile with a staff tag).
  assigned_ops_contact  uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table  public.landlords is 'Landlord application + KYC state. status is admin/service-role writable only.';
comment on column public.landlords.assigned_ops_contact is 'profiles.id of the staff member looking after this landlord.';

create index landlords_status_idx on public.landlords (status);
create index landlords_assigned_ops_contact_idx on public.landlords (assigned_ops_contact);

create trigger landlords_set_updated_at
  before update on public.landlords
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guard: status and assigned_ops_contact are never client-writable.
-- Only an admin or the service role (or a direct DB connection) may set them.
-- TODO(dojah): KYC webhook handler will move status applied → kyc_pending →
--              kyc_verified/kyc_rejected using the service role.
-- ---------------------------------------------------------------------------
create or replace function public.guard_landlord_protected_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'applied' then
      raise exception 'landlords.status can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.assigned_ops_contact is not null then
      raise exception 'landlords.assigned_ops_contact can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      raise exception 'landlords.status can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.assigned_ops_contact is distinct from old.assigned_ops_contact then
      raise exception 'landlords.assigned_ops_contact can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger landlords_guard_protected_columns
  before insert or update on public.landlords
  for each row execute function public.guard_landlord_protected_columns();

-- ---------------------------------------------------------------------------
-- Privileges + Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.landlords enable row level security;

revoke all on table public.landlords from anon, authenticated;
grant select, insert, update on table public.landlords to authenticated;
grant all on table public.landlords to service_role;

-- A landlord can read their own row.
create policy "landlords: landlord selects own row"
  on public.landlords for select
  to authenticated
  using ((select auth.uid()) = id);

-- Staff (bd / inspector) and admin can read every landlord.
create policy "landlords: staff and admin select all rows"
  on public.landlords for select
  to authenticated
  using ((select public.is_staff_or_admin()));

-- A landlord-tagged user can create their own landlord row (the /landlord/apply
-- flow). status is forced to 'applied' by the guard trigger.
create policy "landlords: landlord inserts own row"
  on public.landlords for insert
  to authenticated
  with check ((select auth.uid()) = id and (select public.has_role('landlord')));

-- A landlord can update their own non-protected columns.
create policy "landlords: landlord updates own row"
  on public.landlords for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Admin can insert / update any landlord (including status).
create policy "landlords: admin inserts any row"
  on public.landlords for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "landlords: admin updates any row"
  on public.landlords for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
