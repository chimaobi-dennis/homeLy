#!/usr/bin/env bash
# LOCAL ONLY. Creates six listed apartments for the seeded dev landlord, each with
# a cover photo cropped from the hero image and uploaded to the LOCAL private
# bucket. Talks only to the local Docker Postgres + local Storage API; it cannot
# run against production (needs the seeded landlord + docker exec). Idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
API="${SUPABASE_LOCAL_API:-http://127.0.0.1:54321}"
SR=$(supabase status -o env 2>/dev/null | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2 || true)
[ -n "${SR:-}" ] || { echo "Local Supabase is not running (npm run db:start)"; exit 1; }
SRC=public/hero/enugu-aerial.jpg

# Local workaround (2026-09-22): storage-api v1.72.1 runs its migration
# "drop-bucketid-objname-index" but its own upload query still does
# `ON CONFLICT (name, bucket_id)`, so every upload 500s (42P10) on a fresh
# local stack. Recreating the plain unique index fixes it. Local only.
DBURL=$(supabase status -o env 2>/dev/null | grep '^DB_URL=' | cut -d'"' -f2)
PW=$(echo "$DBURL" | sed -E 's#postgresql://[^:]+:([^@]+)@.*#\1#')
docker exec -i -e PGPASSWORD="$PW" supabase_db_homely psql -h 127.0.0.1 -U supabase_admin -d postgres -q \
  -c "create unique index if not exists bucketid_objname on storage.objects (bucket_id, name);"

TMP=$(mktemp -d)
LANDLORD=00000000-0000-4000-8000-000000000003   # landlord@homely.local from seed.sql

# id | area | headline | beds | baths | sqm | furnishing | annual rent | amenities | available_from | crop offset "y x"
ROWS=(
  "101|Independence Layout|2-bedroom flat with borehole and prepaid meter|2|2|85|semi_furnished|1800000|{borehole_water,prepaid_meter,tiled_floors,parking}|2026-10-01|60 40"
  "102|GRA|3-bedroom bungalow in a gated estate|3|3|140|unfurnished|3500000|{gated_estate,security_guard,generator,parking,water_heater}|2026-11-01|520 560"
  "103|New Haven|Self-contained studio near Ogui Road|1|1|32|furnished|650000|{prepaid_meter,tiled_floors,wardrobes}||300 20"
  "104|Trans-Ekulu|4-bedroom duplex with generator and CCTV|4|4|210|unfurnished|5000000|{generator,cctv,fenced_compound,parking,air_conditioning,balcony}|2026-12-15|40 560"
  "105|Achara Layout|2-bedroom flat, tiled floors and parking|2|1|70|unfurnished|1200000|{tiled_floors,parking,prepaid_meter}||600 40"
  "106|Abakpa|1-bedroom mini flat in a fenced compound|1|1|45|unfurnished|450000|{fenced_compound,borehole_water}|2026-10-15|300 560"
)

SQL=""
for r in "${ROWS[@]}"; do
  IFS='|' read -r n area head beds baths sqm furn rent amen avail off <<<"$r"
  pid="00000000-0000-4000-8000-000000000$n"
  path="$pid/aaaaaaaa-0000-4000-8000-000000000$n-cover.jpg"
  # shellcheck disable=SC2086
  sips -c 300 480 --cropOffset $off "$SRC" --out "$TMP/$n.jpg" >/dev/null
  # Delete-then-create: the local storage image rejects x-upsert with 42P10, and a
  # plain POST on an existing path returns 400, so re-runs replace the object.
  curl -s -o /dev/null -X DELETE "$API/storage/v1/object/property-photos/$path" -H "apikey: $SR" -H "Authorization: Bearer $SR"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/storage/v1/object/property-photos/$path" \
    -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: image/jpeg" --data-binary "@$TMP/$n.jpg")
  echo "photo $n → HTTP $code"
  availsql="null"; [ -n "$avail" ] && availsql="'$avail'"
  SQL+="
insert into public.properties (id, landlord_id, address, city, area, bedrooms, bathrooms, size_sqm, furnishing, amenities, listing_headline, description, target_annual_rent, available_from, status)
values ('$pid', '$LANDLORD', 'Dev fixture $n (private address), Enugu', 'Enugu', '$area', $beds, $baths, $sqm, '$furn', '$amen', '$head', 'Local development fixture. Not a real listing.', $rent, $availsql, 'under_inspection')
on conflict (id) do nothing;
insert into public.property_photos (property_id, storage_path, caption, sort_order)
values ('$pid', '$path', 'Front view', 0) on conflict (storage_path) do nothing;
update public.properties set status = 'listed' where id = '$pid' and status <> 'listed';"
done

docker exec -i supabase_db_homely psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 <<<"$SQL"
docker exec -i supabase_db_homely psql -U postgres -d postgres -Atc "select count(*) || ' listed' from public.properties where status = 'listed';"
rm -rf "$TMP"
