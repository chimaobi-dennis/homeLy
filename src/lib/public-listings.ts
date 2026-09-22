import "server-only";

import { PHOTO_BUCKET, RENT_RANGE, SIZE_RANGE, SORT_OPTIONS, type ListingSort } from "@/lib/listings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

export type PublicListing = Database["public"]["Views"]["public_listings"]["Row"];
export type Furnishing = Database["public"]["Enums"]["property_furnishing"];

export type PublicListingCard = PublicListing & {
  id: string;
  coverUrl: string | null;
  coverAlt: string | null;
  /** Number of photos on the listing (shown on the card like the reference's camera badge). */
  photoCount: number;
};

export type ListingQuery = {
  /** Free text; every word must appear in the headline, area, city or description. */
  q?: string | null;
  area?: string | null;
  /** 1–3 exact, 4 means "4 or more". */
  bedrooms?: number | null;
  bathrooms?: number | null;
  furnishing?: Furnishing | null;
  minRent?: number | null;
  maxRent?: number | null;
  minSize?: number | null;
  maxSize?: number | null;
  sort?: ListingSort;
  limit?: number;
  offset?: number;
};

/** Photo signed URLs live this long; pages that show them are cached for far less. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Columns the free-text search looks in. All are public view columns (never the address). */
const TEXT_COLUMNS = ["listing_headline", "area", "city", "description"] as const;

const FURNISHING_VALUES: ReadonlySet<string> = new Set(["unfurnished", "semi_furnished", "furnished"]);

/** Distinct neighbourhoods from REAL listed data — the filters never hardcode areas. */
export async function getListingAreas(): Promise<string[]> {
  return (await getAreaCounts()).map((a) => a.area);
}

/** Areas with how many listed homes each has (sidebar "Areas" list). */
export async function getAreaCounts(): Promise<Array<{ area: string; count: number }>> {
  const supabase = createPublicClient();
  const { data } = await supabase.from("public_listings").select("area").not("area", "is", null);
  const counts = new Map<string, number>();
  for (const row of data ?? []) if (row.area) counts.set(row.area, (counts.get(row.area) ?? 0) + 1);
  return [...counts.entries()].map(([area, count]) => ({ area, count })).sort((a, b) => a.area.localeCompare(b.area));
}

/**
 * Listed apartments through the anon view (privacy-safe columns only), with the
 * cover photo signed server-side by the service role. Anonymous visitors never
 * touch the private bucket. `total` counts every match, not just the page.
 */
export async function getPublicListingsPage(q: ListingQuery = {}): Promise<{ items: PublicListingCard[]; total: number }> {
  const supabase = createPublicClient();
  let query = supabase.from("public_listings").select("*", { count: "exact" });

  switch (q.sort ?? "newest") {
    case "oldest":
      query = query.order("listed_at", { ascending: true, nullsFirst: false });
      break;
    case "rent_desc":
      query = query.order("annual_rent", { ascending: false, nullsFirst: false });
      break;
    case "rent_asc":
      query = query.order("annual_rent", { ascending: true, nullsFirst: false });
      break;
    default:
      query = query.order("listed_at", { ascending: false, nullsFirst: false });
  }
  query = query.order("id", { ascending: true }); // stable pagination

  if (q.area) query = query.eq("area", q.area);
  if (q.bedrooms != null) query = q.bedrooms >= 4 ? query.gte("bedrooms", 4) : query.eq("bedrooms", q.bedrooms);
  if (q.bathrooms != null) query = q.bathrooms >= 4 ? query.gte("bathrooms", 4) : query.eq("bathrooms", q.bathrooms);
  if (q.furnishing) query = query.eq("furnishing", q.furnishing);
  if (q.minRent != null) query = query.gte("annual_rent", q.minRent);
  if (q.maxRent != null) query = query.lte("annual_rent", q.maxRent);
  if (q.minSize != null) query = query.gte("size_sqm", q.minSize);
  if (q.maxSize != null) query = query.lte("size_sqm", q.maxSize);
  // One `or` filter per word; PostgREST ANDs separate filters, so every word must match
  // somewhere. `q` is reduced to letters/digits/spaces/'/- by parseListingQuery, so it
  // cannot carry PostgREST syntax (commas, parentheses, dots).
  for (const word of (q.q ?? "").split(" ").filter(Boolean).slice(0, 5)) {
    query = query.or(TEXT_COLUMNS.map((c) => `${c}.ilike.%${word}%`).join(","));
  }

  const limit = q.limit ?? 24;
  const offset = q.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

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
  const photoCount = new Map<string, number>();
  for (const p of photos ?? []) {
    if (!p.property_id || !p.storage_path) continue;
    photoCount.set(p.property_id, (photoCount.get(p.property_id) ?? 0) + 1);
    if (!cover.has(p.property_id)) cover.set(p.property_id, { path: p.storage_path, caption: p.caption ?? null });
  }

  const signed = new Map<string, string>();
  if (cover.size) {
    const admin = createAdminClient();
    const { data: urls } = await admin.storage.from(PHOTO_BUCKET).createSignedUrls([...cover.values()].map((c) => c.path), SIGNED_URL_TTL_SECONDS);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  const items = rows.map((r) => {
    const c = cover.get(r.id);
    return { ...r, coverUrl: c ? (signed.get(c.path) ?? null) : null, coverAlt: c?.caption ?? null, photoCount: photoCount.get(r.id) ?? 0 };
  });
  return { items, total };
}

export async function getPublicListings(q: ListingQuery = {}): Promise<PublicListingCard[]> {
  return (await getPublicListingsPage(q)).items;
}

export type ListingSearchParams = {
  q?: string;
  area?: string;
  bedrooms?: string;
  bathrooms?: string;
  furnishing?: string;
  min_rent?: string;
  max_rent?: string;
  min_size?: string;
  max_size?: string;
  sort?: string;
  page?: string;
  view?: string;
};

function intInRange(raw: string | undefined, min: number, max: number): number | null {
  const n = Number(String(raw ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && raw !== undefined && raw !== "" && n >= min && n <= max ? n : null;
}

/** Parse search params defensively. Unknown values fall back to "any"; slider values at their bound mean "no limit". */
export function parseListingQuery(params: ListingSearchParams): ListingQuery {
  const q =
    (params.q ?? "")
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || null;
  const area = params.area?.trim() ? params.area.trim().slice(0, 80) : null;
  const rooms = (raw?: string) => {
    const b = Number(raw);
    return Number.isInteger(b) && b >= 1 && b <= 4 ? b : null;
  };
  const furnishing = params.furnishing && FURNISHING_VALUES.has(params.furnishing) ? (params.furnishing as Furnishing) : null;
  const minRent = intInRange(params.min_rent, RENT_RANGE.min, RENT_RANGE.max);
  const maxRent = intInRange(params.max_rent, RENT_RANGE.min, RENT_RANGE.max);
  const minSize = intInRange(params.min_size, SIZE_RANGE.min, SIZE_RANGE.max);
  const maxSize = intInRange(params.max_size, SIZE_RANGE.min, SIZE_RANGE.max);
  const sort = SORT_OPTIONS.some((o) => o.value === params.sort) ? (params.sort as ListingSort) : "newest";
  return {
    q,
    area,
    bedrooms: rooms(params.bedrooms),
    bathrooms: rooms(params.bathrooms),
    furnishing,
    minRent: minRent != null && minRent > RENT_RANGE.min ? minRent : null,
    maxRent: maxRent != null && maxRent < RENT_RANGE.max ? maxRent : null,
    minSize: minSize != null && minSize > SIZE_RANGE.min ? minSize : null,
    maxSize: maxSize != null && maxSize < SIZE_RANGE.max ? maxSize : null,
    sort,
  };
}

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : 1;
}

export type ListingView = "2" | "3" | "list";
export function parseView(raw: string | undefined): ListingView {
  return raw === "3" || raw === "list" ? raw : "2";
}
