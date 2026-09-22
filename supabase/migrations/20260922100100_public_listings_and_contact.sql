-- HomeLy · migration 0017 (Homepage redesign: public listings + contact)
-- Anonymous visitors may now see LISTED apartments — but only a reduced,
-- privacy-safe shape. Nothing here grants anon any access to base tables.
--
-- Column privacy instrument: security_barrier VIEWS owned by postgres.
--   A view runs with its OWNER's privileges (Postgres default), so it sees all
--   rows, keeps only status = 'listed', and projects only safe columns. The
--   street address, landlord_id, status, reasons and the maintenance limit are
--   not columns of the view, so no query through it can reach them.
--   security_barrier stops user predicates being evaluated before the view's
--   own filter (no leaking unlisted rows via leaky functions).

-- ---------------------------------------------------------------------------
-- 1. properties.area — the neighbourhood shown publicly instead of the address.
--    Listing content: written by staff/admin, never by the landlord.
-- ---------------------------------------------------------------------------
alter table public.properties
  add column area text check (area is null or length(btrim(area)) between 1 and 80);

comment on column public.properties.area is 'Neighbourhood / area name shown publicly (e.g. Independence Layout). Never the street address.';

create index properties_listed_area_idx on public.properties (area) where status = 'listed';

-- Guard trigger: `area` joins the listing-content set (staff-only columns).
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

-- ---------------------------------------------------------------------------
-- 2. Public views (the ONLY anon-readable shape of a property)
-- ---------------------------------------------------------------------------
create view public.public_listings
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
    p.listed_at
  from public.properties p
  where p.status = 'listed';

comment on view public.public_listings is 'Anon-readable, privacy-safe shape of LISTED properties. No address, landlord, status or internal fields. Owned by postgres (bypasses RLS on purpose).';

revoke all on public.public_listings from public;
grant select on public.public_listings to anon, authenticated, service_role;

create view public.public_listing_photos
with (security_barrier = true) as
  select ph.id, ph.property_id, ph.storage_path, ph.caption, ph.sort_order
  from public.property_photos ph
  join public.properties p on p.id = ph.property_id
  where p.status = 'listed';

comment on view public.public_listing_photos is 'Photo paths (private bucket) for LISTED properties only. The server signs URLs with the service role; anon never reads the bucket.';

revoke all on public.public_listing_photos from public;
grant select on public.public_listing_photos to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. contact_messages + rate-limited submit RPC
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(btrim(name)) between 1 and 120),
  whatsapp_number  text not null check (whatsapp_number ~ '^\+?[0-9][0-9 ()-]{5,19}$'),
  message          text not null check (length(btrim(message)) between 1 and 2000),
  -- salted hash of the client IP, for rate limiting only; the IP itself is never stored
  ip_hash          text,
  created_at       timestamptz not null default now()
);

comment on table public.contact_messages is 'Homepage contact form. Written only via submit_contact_message() (rate limited); read by staff/admin. No email is sent (notifyByEmail stays a stub).';

create index contact_messages_created_idx on public.contact_messages (created_at desc);
create index contact_messages_ip_recent_idx on public.contact_messages (ip_hash, created_at desc);
create index contact_messages_whatsapp_recent_idx on public.contact_messages (whatsapp_number, created_at desc);

alter table public.contact_messages enable row level security;

revoke all on table public.contact_messages from anon, authenticated;
grant select on table public.contact_messages to authenticated;
grant all on table public.contact_messages to service_role;

create policy "contact_messages: staff and admin select"
  on public.contact_messages for select
  to authenticated
  using ((select public.is_staff_or_admin()));

-- No direct INSERT for anon/authenticated: a direct insert policy would let a
-- caller bypass the rate limit through the REST API. Everything goes through
-- this SECURITY DEFINER function, which counts recent rows before inserting.
create or replace function public.submit_contact_message(
  p_name text,
  p_whatsapp text,
  p_message text,
  p_ip_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent int;
  v_id uuid;
begin
  if p_ip_hash is not null then
    select count(*) into v_recent
      from public.contact_messages
     where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if v_recent >= 5 then
      raise exception 'Too many messages from this connection in the last hour. Please try again later, or reach us on WhatsApp.'
        using errcode = 'P0001';
    end if;
  end if;

  select count(*) into v_recent
    from public.contact_messages
   where whatsapp_number = btrim(p_whatsapp) and created_at > now() - interval '1 day';
  if v_recent >= 3 then
    raise exception 'We already have your messages for today and will reply on WhatsApp.'
      using errcode = 'P0001';
  end if;

  insert into public.contact_messages (name, whatsapp_number, message, ip_hash)
  values (btrim(p_name), btrim(p_whatsapp), btrim(p_message), p_ip_hash)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.submit_contact_message(text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text) to anon, authenticated, service_role;

comment on function public.submit_contact_message(text, text, text, text) is 'Rate-limited (5/hour per IP hash, 3/day per WhatsApp number) contact form insert. The only write path into contact_messages.';
