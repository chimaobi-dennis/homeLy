-- 0019 — Homepage media (admin-uploaded images/videos for the "Why choose HomeLy"
-- slider) and "Property of the day" (properties.featured_at, admin-only).
--
-- 1. properties.featured_at: the homepage shows the most recently featured LISTED
--    property. Only an admin (or the service role) may set it — enforced in the
--    guard trigger below (staff and landlords get 42501), same pattern as listed_at.
alter table public.properties add column if not exists featured_at timestamptz;
comment on column public.properties.featured_at is 'Set by an admin to feature the property on the homepage ("Property of the day"); the latest wins.';

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
    if new.featured_at is not null then
      raise exception 'properties.featured_at can only be set by an admin or the service role'
        using errcode = '42501';
    end if;
    if not writer_is_staff and (
         new.listing_headline is not null or new.description is not null
      or new.bathrooms is not null or new.size_sqm is not null
      or new.furnishing is not null or cardinality(new.amenities) > 0
      or new.available_from is not null or new.area is not null
    ) then
      raise exception 'Listing content is written by HomeLy staff, not by the landlord'
        using errcode = '42501';
    end if;
    return new;
  end if;

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
  if new.featured_at is distinct from old.featured_at then
    raise exception 'properties.featured_at can only be changed by an admin or the service role'
      using errcode = '42501';
  end if;

  listing_changed :=
       new.listing_headline is distinct from old.listing_headline
    or new.description      is distinct from old.description
    or new.bathrooms        is distinct from old.bathrooms
    or new.size_sqm         is distinct from old.size_sqm
    or new.furnishing       is distinct from old.furnishing
    or new.amenities        is distinct from old.amenities
    or new.available_from   is distinct from old.available_from
    or new.area             is distinct from old.area;

  core_changed :=
       new.address            is distinct from old.address
    or new.city               is distinct from old.city
    or new.bedrooms           is distinct from old.bedrooms
    or new.target_annual_rent is distinct from old.target_annual_rent;

  if writer_is_staff then
    if core_changed or new.maintenance_threshold_ngn is distinct from old.maintenance_threshold_ngn then
      raise exception 'Staff may edit listing content only; address, city, bedrooms, rent and the maintenance limit belong to the landlord (or admin)'
        using errcode = '42501';
    end if;
    return new;
  end if;

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

-- 2. Public view: featured_at appended (create or replace view forbids reordering).
create or replace view public.public_listings
with (security_barrier = true) as
  select
    p.id,
    p.listing_headline,
    p.area,
    p.city,
    p.bedrooms,
    p.bathrooms,
    p.size_sqm,
    p.furnishing,
    p.amenities,
    p.available_from,
    p.target_annual_rent as annual_rent,
    p.listed_at,
    p.description,
    p.featured_at
  from public.properties p
  where p.status = 'listed';

-- 3. homepage_media — what the admin uploads for the homepage media slider.
create table public.homepage_media (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('image', 'video')),
  storage_path text not null unique,
  caption      text check (caption is null or length(caption) <= 200),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint homepage_media_path_prefix check (storage_path like 'homepage/%')
);
comment on table public.homepage_media is 'Admin-uploaded images/videos shown in the homepage "Why choose HomeLy" slider. Objects live in the PUBLIC site-media bucket.';

alter table public.homepage_media enable row level security;

-- Everyone sees active items (the homepage renders them for anonymous visitors).
create policy "homepage_media: public reads active"
  on public.homepage_media for select
  to anon, authenticated
  using (is_active);

-- Admins see and manage everything.
create policy "homepage_media: admin reads all"
  on public.homepage_media for select
  to authenticated
  using ((select public.is_admin()));
create policy "homepage_media: admin inserts"
  on public.homepage_media for insert
  to authenticated
  with check ((select public.is_admin()));
create policy "homepage_media: admin updates"
  on public.homepage_media for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "homepage_media: admin deletes"
  on public.homepage_media for delete
  to authenticated
  using ((select public.is_admin()));

grant select on table public.homepage_media to anon;
grant select, insert, update, delete on table public.homepage_media to authenticated;
grant all on table public.homepage_media to service_role;

-- 4. PUBLIC bucket for homepage media: marketing assets, served by URL, no signing
--    (videos stream straight from storage). Uploads: browser → bucket under the
--    admin's session (policies below), then a server action records the row.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 62914560,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

create policy "site-media: admin upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'site-media' and (select public.is_admin()));
create policy "site-media: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-media' and (select public.is_admin()))
  with check (bucket_id = 'site-media' and (select public.is_admin()));
create policy "site-media: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'site-media' and (select public.is_admin()));
create policy "site-media: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'site-media');
