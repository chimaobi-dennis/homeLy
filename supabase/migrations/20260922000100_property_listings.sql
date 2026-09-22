-- HomeLy · migration 0016 (Step 7: property listings)
-- Listing content + photos on top of the Step 2 `properties` table.
-- DECISION: listing content and photos are authored by HomeLy staff/admin, not
-- by landlords (HomeLy manages the apartment). Landlords read their listing.
-- Verified tenants (Stage 2, kyc_status = 'verified') read LISTED properties
-- and their photos. Nothing here is public.

-- ---------------------------------------------------------------------------
-- 1. Listing fields on properties
-- ---------------------------------------------------------------------------
create type public.property_furnishing as enum ('unfurnished', 'semi_furnished', 'furnished');

alter table public.properties
  add column listing_headline text,
  add column description      text,
  add column bathrooms        integer check (bathrooms is null or bathrooms >= 0),
  add column size_sqm         numeric check (size_sqm is null or size_sqm > 0),
  add column furnishing       public.property_furnishing,
  add column amenities        text[] not null default '{}',
  add column available_from   date,
  -- Set by trigger when status moves to 'listed'; cleared when it moves away.
  add column listed_at        timestamptz;

-- ASSUMPTION: fixed amenity vocabulary for the Enugu market. Mirrored in
-- src/lib/listings.ts (AMENITIES) — keep both in sync; extend with a migration.
alter table public.properties add constraint properties_amenities_allowed check (
  amenities <@ array[
    'borehole_water', 'prepaid_meter', 'generator', 'solar_inverter',
    'security_guard', 'gated_estate', 'fenced_compound', 'cctv',
    'parking', 'water_heater', 'air_conditioning', 'wardrobes',
    'kitchen_cabinets', 'pop_ceiling', 'tiled_floors', 'balcony',
    'waste_disposal'
  ]::text[]
);
alter table public.properties add constraint properties_listing_headline_len
  check (listing_headline is null or length(btrim(listing_headline)) between 1 and 120);
alter table public.properties add constraint properties_description_len
  check (description is null or length(description) <= 5000);

comment on column public.properties.listed_at is 'When status last became listed. Maintained by trigger; admin/service only.';
comment on column public.properties.amenities is 'Subset of the fixed list in properties_amenities_allowed.';

create index properties_listed_at_idx on public.properties (listed_at desc) where status = 'listed';

-- listed_at follows status.
create or replace function public.set_property_listed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'listed' and (tg_op = 'INSERT' or old.status is distinct from 'listed') then
    new.listed_at := now();
  elsif new.status <> 'listed' then
    new.listed_at := null;
  end if;
  return new;
end;
$$;

create trigger properties_set_listed_at
  before insert or update on public.properties
  for each row execute function public.set_property_listed_at();

-- A property cannot become 'listed' without the minimum listing content.
-- Applies to EVERY writer, service role included.
create or replace function public.enforce_publish_requirements()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'listed' and (tg_op = 'INSERT' or old.status is distinct from 'listed') then
    if new.description is null or length(btrim(new.description)) = 0 then
      raise exception 'Cannot list this property: a description is required' using errcode = '23514';
    end if;
    if new.target_annual_rent is null or new.target_annual_rent <= 0 then
      raise exception 'Cannot list this property: target annual rent must be set' using errcode = '23514';
    end if;
    if not exists (select 1 from public.property_photos ph where ph.property_id = new.id) then
      raise exception 'Cannot list this property: at least one photo is required' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. property_photos + private bucket
--    Key layout: <property uuid>/<uuid>-<filename>
-- ---------------------------------------------------------------------------
create table public.property_photos (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties (id) on delete cascade,
  storage_path  text not null unique,
  caption       text check (caption is null or length(caption) <= 200),
  sort_order    integer not null default 0,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint property_photos_path_under_property
    check (storage_path like (property_id::text || '/%'))
);

comment on table public.property_photos is 'One row per photo in the private property-photos bucket. Ordering is explicit (sort_order).';

create index property_photos_property_order_idx on public.property_photos (property_id, sort_order, created_at);

-- Now that the table exists, attach the publish-requirements trigger.
-- BEFORE triggers fire in NAME order: properties_guard_protected_columns
-- (authorization, 42501) → properties_publish_requirements (business rule,
-- 23514) → properties_set_listed_at (derived column). Keep the names sorted.
create trigger properties_publish_requirements
  before insert or update on public.properties
  for each row execute function public.enforce_publish_requirements();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
-- Stage 2 tenant whose ID has been verified by hand.
create or replace function public.is_verified_tenant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tenants t
     where t.id = auth.uid() and t.kyc_status = 'verified'
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Guard trigger — DELIBERATE EXTENSION of migration 0010.
--    What changed:
--      a) `listed_at` joins the admin/service-only set (like status).
--      b) Column sets are now role-scoped for non-privileged writers:
--         - landlords: may change ONLY maintenance_threshold_ngn at any status,
--           plus the four core fields while status = 'submitted' (0010 rule
--           kept verbatim). They may NEVER change listing content.
--         - staff (bd / inspector): may change ONLY listing content
--           (listing_headline, description, bathrooms, size_sqm, furnishing,
--           amenities, available_from) at ANY status — the 0010 lock does not
--           apply to listing content by design. They may not change core
--           fields, the threshold, status or reasons.
--      c) Landlord INSERTs must not carry listing content.
--    Admin and the service role are unchanged (short-circuit at the top).
-- ---------------------------------------------------------------------------
create or replace function public.guard_property_protected_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing_changed boolean;
  core_changed    boolean;
  writer_is_staff boolean;
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  writer_is_staff := public.is_staff_or_admin();

  if tg_op = 'INSERT' then
    if new.status <> 'submitted' then
      raise exception 'properties.status can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.rejection_reason is not null then
      raise exception 'properties.rejection_reason can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
    if new.listed_at is not null then
      raise exception 'properties.listed_at can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
    if not writer_is_staff and (
         new.listing_headline is not null or new.description is not null
      or new.bathrooms is not null or new.size_sqm is not null
      or new.furnishing is not null or cardinality(new.amenities) > 0
      or new.available_from is not null
    ) then
      raise exception 'Listing content is written by HomeLy staff, not by the landlord'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: admin/service-only columns, for every non-privileged writer.
  if new.status is distinct from old.status then
    raise exception 'properties.status can only be changed by an admin or the service role'
      using errcode = '42501';
  end if;
  if new.landlord_id is distinct from old.landlord_id then
    raise exception 'properties.landlord_id can only be changed by an admin or the service role'
      using errcode = '42501';
  end if;
  if new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'properties.rejection_reason can only be changed by an admin or the service role'
      using errcode = '42501';
  end if;
  if new.listed_at is distinct from old.listed_at then
    raise exception 'properties.listed_at can only be changed by an admin or the service role'
      using errcode = '42501';
  end if;

  listing_changed :=
       new.listing_headline is distinct from old.listing_headline
    or new.description      is distinct from old.description
    or new.bathrooms        is distinct from old.bathrooms
    or new.size_sqm         is distinct from old.size_sqm
    or new.furnishing       is distinct from old.furnishing
    or new.amenities        is distinct from old.amenities
    or new.available_from   is distinct from old.available_from;

  core_changed :=
       new.address            is distinct from old.address
    or new.city               is distinct from old.city
    or new.bedrooms           is distinct from old.bedrooms
    or new.target_annual_rent is distinct from old.target_annual_rent;

  if writer_is_staff then
    -- Staff: listing content only.
    if core_changed or new.maintenance_threshold_ngn is distinct from old.maintenance_threshold_ngn then
      raise exception 'Staff may edit listing content only; address, city, bedrooms, rent and the maintenance limit belong to the landlord (or admin)'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Landlord: never listing content; core fields locked once past submitted (0010).
  if listing_changed then
    raise exception 'Listing content is written by HomeLy staff, not by the landlord'
      using errcode = '42501';
  end if;
  if old.status <> 'submitted' and core_changed then
    raise exception 'properties.address, city, bedrooms and target_annual_rent are locked while status is %; resubmit the property or contact HomeLy', old.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Policies
-- ---------------------------------------------------------------------------
-- properties: staff may UPDATE (the trigger narrows them to listing content).
create policy "properties: staff updates any row"
  on public.properties for update
  to authenticated
  using ((select public.is_staff_or_admin()))
  with check ((select public.is_staff_or_admin()));

-- properties: verified tenants read LISTED rows only (needed for browse and for
-- the photo/storage policies below, whose subqueries run under this RLS).
create policy "properties: verified tenants select listed rows"
  on public.properties for select
  to authenticated
  using (status = 'listed' and (select public.is_verified_tenant()));

-- profiles: staff need landlord names for the properties list (DECISION —
-- narrow: landlord-tagged profiles only, not other staff or admin profiles).
create policy "profiles: staff selects landlord profiles"
  on public.profiles for select
  to authenticated
  using ((select public.is_staff_or_admin()) and 'landlord' = any (role_tags));

-- property_photos
alter table public.property_photos enable row level security;

revoke all on table public.property_photos from anon, authenticated;
grant select, insert, update, delete on table public.property_photos to authenticated;
grant all on table public.property_photos to service_role;

create policy "property_photos: staff and admin select all rows"
  on public.property_photos for select
  to authenticated
  using ((select public.is_staff_or_admin()));

create policy "property_photos: staff and admin insert"
  on public.property_photos for insert
  to authenticated
  with check ((select public.is_staff_or_admin()));

create policy "property_photos: staff and admin update"
  on public.property_photos for update
  to authenticated
  using ((select public.is_staff_or_admin()))
  with check ((select public.is_staff_or_admin()));

create policy "property_photos: staff and admin delete"
  on public.property_photos for delete
  to authenticated
  using ((select public.is_staff_or_admin()));

create policy "property_photos: landlord selects own property rows"
  on public.property_photos for select
  to authenticated
  using (exists (
    select 1 from public.properties p
     where p.id = property_id and p.landlord_id = (select auth.uid())
  ));

create policy "property_photos: verified tenants select listed property rows"
  on public.property_photos for select
  to authenticated
  using (
    (select public.is_verified_tenant())
    and exists (select 1 from public.properties p where p.id = property_id and p.status = 'listed')
  );

-- storage.objects for property-photos. Folder = property uuid.
create policy "property-photos: staff and admin upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'property-photos' and (select public.is_staff_or_admin()));

create policy "property-photos: staff and admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'property-photos' and (select public.is_staff_or_admin()));

create policy "property-photos: staff and admin read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'property-photos' and (select public.is_staff_or_admin()));

create policy "property-photos: landlord reads own property folders"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'property-photos'
    and exists (
      select 1 from public.properties p
       where p.id::text = (storage.foldername(name))[1] and p.landlord_id = (select auth.uid())
    )
  );

create policy "property-photos: verified tenants read listed property folders"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'property-photos'
    and (select public.is_verified_tenant())
    and exists (
      select 1 from public.properties p
       where p.id::text = (storage.foldername(name))[1] and p.status = 'listed'
    )
  );
