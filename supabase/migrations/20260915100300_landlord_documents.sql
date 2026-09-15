-- HomeLy · migration 0009 (Step 2: landlord onboarding)
-- KYC documents: a private Storage bucket plus a metadata table.
-- Store-and-await-manual-review only — no automated verification.
-- TODO(dojah): automated ID verification would hook in after upload.

-- ---------------------------------------------------------------------------
-- Metadata table
-- ---------------------------------------------------------------------------
create type public.landlord_document_type as enum (
  'id_document',
  'proof_of_ownership'
);

create table public.landlord_documents (
  id                 uuid primary key default gen_random_uuid(),
  landlord_id        uuid not null references public.landlords (id) on delete cascade,
  -- proof_of_ownership is normally tied to a property; id_document is not.
  property_id        uuid references public.properties (id) on delete set null,
  document_type      public.landlord_document_type not null,
  -- Object key inside the `landlord-documents` bucket: '<landlord_id>/<type>/<uuid>-<filename>'
  storage_path       text not null unique,
  original_filename  text not null check (length(original_filename) between 1 and 255),
  mime_type          text not null,
  size_bytes         bigint not null check (size_bytes > 0),
  uploaded_at        timestamptz not null default now(),
  -- Every object must live under the owning landlord's folder.
  constraint landlord_documents_path_under_owner
    check (storage_path like (landlord_id::text || '/%'))
);

comment on table public.landlord_documents is 'Metadata for KYC uploads in the private landlord-documents bucket. Manual review only.';

create index landlord_documents_landlord_id_idx on public.landlord_documents (landlord_id);
create index landlord_documents_property_id_idx on public.landlord_documents (property_id);

alter table public.landlord_documents enable row level security;

revoke all on table public.landlord_documents from anon, authenticated;
grant select, insert on table public.landlord_documents to authenticated;
grant all on table public.landlord_documents to service_role;

create policy "landlord_documents: landlord selects own rows"
  on public.landlord_documents for select
  to authenticated
  using ((select auth.uid()) = landlord_id);

create policy "landlord_documents: staff and admin select all rows"
  on public.landlord_documents for select
  to authenticated
  using ((select public.is_staff_or_admin()));

create policy "landlord_documents: landlord inserts own rows"
  on public.landlord_documents for insert
  to authenticated
  with check ((select auth.uid()) = landlord_id and (select public.has_role('landlord')));

-- No client UPDATE / DELETE: re-upload creates a new row; removal is service-role only.

-- ---------------------------------------------------------------------------
-- Private Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landlord-documents',
  'landlord-documents',
  false,
  10485760, -- 10 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Object-level policies. storage.objects already has RLS enabled.
-- Path layout: <landlord uuid>/<document type>/<file>  →  foldername(name)[1] = landlord uuid.

create policy "landlord-documents: landlord uploads into own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'landlord-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.has_role('landlord'))
  );

create policy "landlord-documents: landlord reads own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'landlord-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "landlord-documents: staff and admin read all"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'landlord-documents'
    and (select public.is_staff_or_admin())
  );

-- No UPDATE / DELETE policies: objects are immutable from the client. Signed
-- URLs (created with the viewer's own session) are the only read path; the
-- bucket is never public.
