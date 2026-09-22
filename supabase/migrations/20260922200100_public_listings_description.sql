-- 0018 — public_listings gains the staff-written listing description.
-- The homepage and /search show it on every property card (Sheltos-style cards
-- carry a short paragraph). It is public listing copy written by staff (never by
-- the landlord — see the guard trigger in 0017), so exposing it through the
-- anon view is intended. Column APPENDED (create or replace view forbids
-- reordering); grants on the view carry over unchanged.
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
    p.description
  from public.properties p
  where p.status = 'listed';

comment on view public.public_listings is
  'Anon-readable shape of a LISTED property: no address, no landlord, no status, no threshold. description is staff-written public copy.';
