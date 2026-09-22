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
  /** Free text from the search bar; every word must appear in the headline, area or city. */
  q?: string | null;
  area?: string | null;
  /** 1–3 exact, 4 means "4 or more". */
  bedrooms?: number | null;
  maxRent?: number | null;
  limit?: number;
};

/** Photo signed URLs live this long; pages/responses that show them are cached for far less. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Columns the free-text search looks in. All are public view columns (never the address). */
const TEXT_COLUMNS = ["listing_headline", "area", "city"] as const;

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
 * visitors never touch the private bucket. `total` counts every match, not just
 * the returned page, so the UI can say "showing 8 of 23".
 */
export async function getPublicListingsPage(q: ListingQuery = {}): Promise<{ items: PublicListingCard[]; total: number }> {
  const supabase = createPublicClient();
  let query = supabase.from("public_listings").select("*", { count: "exact" }).order("listed_at", { ascending: false, nullsFirst: false });
  if (q.area) query = query.eq("area", q.area);
  if (q.bedrooms != null) query = q.bedrooms >= 4 ? query.gte("bedrooms", 4) : query.eq("bedrooms", q.bedrooms);
  if (q.maxRent != null) query = query.lte("annual_rent", q.maxRent);
  // One `or` filter per word; PostgREST ANDs separate filters, so every word must match somewhere.
  // `q` is already reduced to letters/digits/spaces/'/- by parseListingQuery, so it cannot
  // carry PostgREST syntax (commas, parentheses, dots).
  for (const word of (q.q ?? "").split(" ").filter(Boolean).slice(0, 5)) {
    query = query.or(TEXT_COLUMNS.map((c) => `${c}.ilike.%${word}%`).join(","));
  }
  query = query.limit(q.limit ?? 24);
  const { data, count } = await query;
  const rows = (data ?? []).filter((r): r is PublicListing & { id: string } => typeof r.id === "string");
  const total = count ?? rows.length;
  if (rows.length === 0) return { items: [], total };

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

  const items = rows.map((r) => {
    const c = cover.get(r.id);
    return { ...r, coverUrl: c ? (signed.get(c.path) ?? null) : null, coverAlt: c?.caption ?? null };
  });
  return { items, total };
}

export async function getPublicListings(q: ListingQuery = {}): Promise<PublicListingCard[]> {
  return (await getPublicListingsPage(q)).items;
}

/** Parse search params defensively. Unknown values fall back to "any". */
export function parseListingQuery(params: { q?: string; area?: string; bedrooms?: string; max_rent?: string }): ListingQuery {
  // Free text: keep letters, digits, spaces, apostrophes and hyphens only, so the
  // value can never smuggle PostgREST filter syntax; cap the length.
  const q =
    (params.q ?? "")
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || null;
  const area = params.area?.trim() ? params.area.trim().slice(0, 80) : null;
  const b = Number(params.bedrooms);
  const bedrooms = Number.isInteger(b) && b >= 1 && b <= 4 ? b : null;
  const m = Number(String(params.max_rent ?? "").replace(/[^0-9]/g, ""));
  const maxRent = Number.isFinite(m) && m > 0 ? m : null;
  return { q, area, bedrooms, maxRent };
}
