-- HomeLy · migration 0015 (Step 5: tenant accounts + queue conversion, Stage 2)
-- Until now tenants had NO account by design. Stage 2 gives a waitlist entry
-- the option to convert into a real auth account (via an admin-issued invite),
-- upload an ID for MANUAL review, and become an active queue member.
-- Stage 1 signup (/waitlist) is unchanged: still anonymous, still no KYC.

-- ---------------------------------------------------------------------------
-- 1. `tenant` becomes an allowed role tag
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_role_tags_valid;
alter table public.profiles add constraint profiles_role_tags_valid
  check (role_tags <@ array['admin', 'bd', 'inspector', 'landlord', 'tenant']::text[]);

comment on column public.profiles.role_tags is 'Subset of {admin,bd,inspector,landlord,tenant}. Only changeable by an admin or the service role.';

-- ---------------------------------------------------------------------------
-- 2. Enums
-- ---------------------------------------------------------------------------
create type public.tenant_kyc_status as enum ('not_started', 'pending', 'verified', 'rejected');
create type public.conversion_invite_status as enum ('pending', 'accepted', 'revoked', 'expired');
-- Tenants upload an ID only. proof_of_ownership is a landlord concept and is NOT reused.
create type public.tenant_document_type as enum ('id_document');

-- ---------------------------------------------------------------------------
-- 3. tenants
-- ---------------------------------------------------------------------------
create table public.tenants (
  id                    uuid primary key references public.profiles (id) on delete cascade,
  -- Nullable on purpose: a future tenant may not have come through the waitlist.
  waitlist_entry_id     uuid references public.waitlist_entries (id) on delete set null,
  kyc_status            public.tenant_kyc_status not null default 'not_started',
  kyc_rejection_reason  text,
  converted_at          timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table  public.tenants is 'Tenant accounts (Stage 2). kyc_status is admin/service-role writable only. TODO(dojah): automated KYC would set it.';
comment on column public.tenants.converted_at is 'When the account was created (from a waitlist entry, or otherwise).';

create unique index tenants_waitlist_entry_id_key on public.tenants (waitlist_entry_id) where waitlist_entry_id is not null;
create index tenants_kyc_status_idx on public.tenants (kyc_status);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- Same guard pattern as landlords.status: protected columns are admin / service role only.
create or replace function public.guard_tenant_protected_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.kyc_status <> 'not_started' or new.kyc_rejection_reason is not null then
      raise exception 'tenants.kyc_status / kyc_rejection_reason can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.kyc_status is distinct from old.kyc_status then
      raise exception 'tenants.kyc_status can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.kyc_rejection_reason is distinct from old.kyc_rejection_reason then
      raise exception 'tenants.kyc_rejection_reason can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.waitlist_entry_id is distinct from old.waitlist_entry_id then
      raise exception 'tenants.waitlist_entry_id can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.converted_at is distinct from old.converted_at then
      raise exception 'tenants.converted_at can only be changed by an admin or the service role'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger tenants_guard_protected_columns
  before insert or update on public.tenants
  for each row execute function public.guard_tenant_protected_columns();

alter table public.tenants enable row level security;

revoke all on table public.tenants from anon, authenticated;
grant select, insert, update on table public.tenants to authenticated;
grant all on table public.tenants to service_role;

create policy "tenants: tenant selects own row"
  on public.tenants for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "tenants: staff and admin select all rows"
  on public.tenants for select
  to authenticated
  using ((select public.is_staff_or_admin()));

-- Rows are created server-side (conversion action, service role). Admin may also manage them.
create policy "tenants: admin inserts any row"
  on public.tenants for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "tenants: admin updates any row"
  on public.tenants for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 4. queue_conversion_invites (modelled on staff_invites; admin-only)
-- ---------------------------------------------------------------------------
create table public.queue_conversion_invites (
  id                 uuid primary key default gen_random_uuid(),
  waitlist_entry_id  uuid not null references public.waitlist_entries (id) on delete cascade,
  invited_by         uuid references public.profiles (id) on delete set null,
  token              text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  status             public.conversion_invite_status not null default 'pending',
  -- ASSUMPTION: 7-day expiry, same as staff invites.
  expires_at         timestamptz not null default now() + interval '7 days',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.queue_conversion_invites is 'Admin-only. Invites a waitlist entry to create a tenant account. The public /waitlist/convert/[token] page resolves tokens server-side.';

create unique index queue_conversion_invites_one_pending_idx
  on public.queue_conversion_invites (waitlist_entry_id) where status = 'pending';
create index queue_conversion_invites_status_idx on public.queue_conversion_invites (status);

create trigger queue_conversion_invites_set_updated_at
  before update on public.queue_conversion_invites
  for each row execute function public.set_updated_at();

alter table public.queue_conversion_invites enable row level security;

revoke all on table public.queue_conversion_invites from anon, authenticated;
grant select, insert, update on table public.queue_conversion_invites to authenticated;
grant all on table public.queue_conversion_invites to service_role;

create policy "queue_conversion_invites: admin selects"
  on public.queue_conversion_invites for select
  to authenticated
  using ((select public.is_admin()));

create policy "queue_conversion_invites: admin inserts"
  on public.queue_conversion_invites for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "queue_conversion_invites: admin updates"
  on public.queue_conversion_invites for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 5. tenant_documents + private bucket (mirrors landlord_documents, own bucket)
--    Object key layout: <tenant uuid>/id_document/<uuid>-<filename>
-- ---------------------------------------------------------------------------
create table public.tenant_documents (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  document_type      public.tenant_document_type not null default 'id_document',
  storage_path       text not null unique,
  original_filename  text not null check (length(original_filename) between 1 and 255),
  mime_type          text not null,
  size_bytes         bigint not null check (size_bytes > 0),
  uploaded_at        timestamptz not null default now(),
  constraint tenant_documents_path_under_owner
    check (storage_path like (tenant_id::text || '/%'))
);

comment on table public.tenant_documents is 'Metadata for tenant ID uploads in the private tenant-documents bucket. Manual review only.';

create index tenant_documents_tenant_id_idx on public.tenant_documents (tenant_id);

alter table public.tenant_documents enable row level security;

revoke all on table public.tenant_documents from anon, authenticated;
grant select, insert on table public.tenant_documents to authenticated;
grant all on table public.tenant_documents to service_role;

create policy "tenant_documents: tenant selects own rows"
  on public.tenant_documents for select
  to authenticated
  using ((select auth.uid()) = tenant_id);

create policy "tenant_documents: staff and admin select all rows"
  on public.tenant_documents for select
  to authenticated
  using ((select public.is_staff_or_admin()));

create policy "tenant_documents: tenant inserts own rows"
  on public.tenant_documents for insert
  to authenticated
  with check ((select auth.uid()) = tenant_id and (select public.has_role('tenant')));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-documents', 'tenant-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "tenant-documents: tenant uploads into own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tenant-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.has_role('tenant'))
  );

create policy "tenant-documents: tenant reads own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tenant-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "tenant-documents: staff and admin read all"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tenant-documents'
    and (select public.is_staff_or_admin())
  );
