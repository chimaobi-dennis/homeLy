import { AMENITY_LABEL, furnishingLabel, isAmenity, PHOTO_BUCKET } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Property = Database["public"]["Tables"]["properties"]["Row"];

/**
 * Read-only view of the listing HomeLy staff wrote for the landlord's property.
 * Reads through the landlord's own session (own-row policies on property_photos
 * and the bucket). Landlords cannot edit any of this by design.
 */
export async function ListingPreview({ property }: { property: Property }) {
  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("property_photos")
    .select("id, storage_path, caption")
    .eq("property_id", property.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const list = photos ?? [];
  const hasContent = Boolean(property.listing_headline || property.description || list.length || property.amenities.length);
  if (!hasContent) return null;

  const signed = new Map<string, string>();
  if (list.length) {
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(
      list.map((p) => p.storage_path),
      600,
    );
    for (const s of data ?? []) if (s.signedUrl && s.path) signed.set(s.path, s.signedUrl);
  }
  const amenities = property.amenities.filter(isAmenity);

  return (
    <details className="mt-4 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <summary className="cursor-pointer font-medium">
        Your listing, as written by HomeLy {property.status === "listed" ? "(live)" : "(draft — not yet published)"}
      </summary>
      <p className="mt-2 text-xs text-zinc-500">HomeLy staff write and photograph the listing. Contact us if anything here is wrong.</p>
      {property.listing_headline ? <p className="mt-3 font-semibold">{property.listing_headline}</p> : null}
      {property.description ? <p className="mt-1 whitespace-pre-line text-zinc-700 dark:text-zinc-300">{property.description}</p> : null}
      <dl className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
        <dt className="text-zinc-500">Bathrooms</dt>
        <dd>{property.bathrooms ?? "—"}</dd>
        <dt className="text-zinc-500">Size</dt>
        <dd>{property.size_sqm ? `${property.size_sqm} sqm` : "—"}</dd>
        <dt className="text-zinc-500">Furnishing</dt>
        <dd>{furnishingLabel(property.furnishing)}</dd>
        <dt className="text-zinc-500">Available from</dt>
        <dd>{property.available_from ?? "—"}</dd>
        {amenities.length ? (
          <>
            <dt className="text-zinc-500">Amenities</dt>
            <dd>{amenities.map((a) => AMENITY_LABEL[a]).join(", ")}</dd>
          </>
        ) : null}
      </dl>
      {list.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((p, i) => (
            <li key={p.id}>
              {signed.get(p.storage_path) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signed.get(p.storage_path)} alt={p.caption ?? `Photo ${i + 1}`} className="aspect-[4/3] w-full rounded object-cover" loading="lazy" />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
