import "server-only";

import { PHOTO_BUCKET } from "@/lib/listings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

export type PublicListing = Database["public"]["Views"]["public_listings"]["Row"];

export type PublicListingCard = PublicListing & {
  id: string;
  coverUrl: string | null;
  coverAlt: string | null;
};

export type ListingQuery = {
  area?: string | null;
  /** 1–3 exact, 4 means "4 or more". */
  bedrooms?: number | null;
  maxRent?: number | null;
  limit?: number;
};

/** Photo signed URLs live this long; pages that show them are cached for far less. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Distinct neighbourhoods from REAL listed data — the hero search never hardcodes areas. */
export async function getListingAreas(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data } = await supabase.from("public_listings").select("area").not("area", "is", null);
  const areas = new Set<string>();
  for (const row of data ?? []) if (row.area) areas.add(row.area);
  return [...areas].sort((a, b) => a.localeCompare(b));
}

/**
 * Listed apartments through the anon view (privacy-safe columns only), newest
 * first, with the cover photo signed server-side by the service role. Anonymous
 * visitors never touch the private bucket.
 */
export async function getPublicListings(q: ListingQuery = {}): Promise<PublicListingCard[]> {
  const supabase = createPublicClient();
  let query = supabase.from("public_listings").select("*").order("listed_at", { ascending: false, nullsFirst: false });
  if (q.area) query = query.eq("area", q.area);
  if (q.bedrooms != null) query = q.bedrooms >= 4 ? query.gte("bedrooms", 4) : query.eq("bedrooms", q.bedrooms);
  if (q.maxRent != null) query = query.lte("annual_rent", q.maxRent);
  query = query.limit(q.limit ?? 24);
  const { data } = await query;
  const rows = (data ?? []).filter((r): r is PublicListing & { id: string } => typeof r.id === "string");
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: photos } = await supabase
    .from("public_listing_photos")
    .select("property_id, storage_path, caption, sort_order")
    .in("property_id", ids)
    .order("sort_order", { ascending: true });
  const cover = new Map<string, { path: string; caption: string | null }>();
  for (const p of photos ?? []) {
    if (p.property_id && p.storage_path && !cover.has(p.property_id)) cover.set(p.property_id, { path: p.storage_path, caption: p.caption ?? null });
  }

  const signed = new Map<string, string>();
  if (cover.size) {
    const admin = createAdminClient();
    const { data: urls } = await admin.storage.from(PHOTO_BUCKET).createSignedUrls([...cover.values()].map((c) => c.path), SIGNED_URL_TTL_SECONDS);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  return rows.map((r) => {
    const c = cover.get(r.id);
    return { ...r, coverUrl: c ? (signed.get(c.path) ?? null) : null, coverAlt: c?.caption ?? null };
  });
}

/** Parse hero-search query params defensively. Unknown values fall back to "any". */
export function parseListingQuery(params: { area?: string; bedrooms?: string; max_rent?: string }): ListingQuery {
  const area = params.area?.trim() ? params.area.trim().slice(0, 80) : null;
  const b = Number(params.bedrooms);
  const bedrooms = Number.isInteger(b) && b >= 1 && b <= 4 ? b : null;
  const m = Number(String(params.max_rent ?? "").replace(/[^0-9]/g, ""));
  const maxRent = Number.isFinite(m) && m > 0 ? m : null;
  return { area, bedrooms, maxRent };
}
