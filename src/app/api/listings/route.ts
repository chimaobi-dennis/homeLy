import { NextResponse } from "next/server";
import { getPublicListingsPage, parseListingQuery } from "@/lib/public-listings";

/**
 * JSON feed behind the homepage's live search dropdown. Anonymous, read-only,
 * and it returns exactly what the public page shows: the anon view's columns
 * plus a short-lived signed cover URL. No address, landlord or status ever
 * leaves here because the view does not have those columns.
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = parseListingQuery({
    q: sp.get("q") ?? undefined,
    area: sp.get("area") ?? undefined,
    bedrooms: sp.get("bedrooms") ?? undefined,
    max_rent: sp.get("max_rent") ?? undefined,
  });
  const requested = Number(sp.get("limit"));
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 12) : 8;

  try {
    const { items, total } = await getPublicListingsPage({ ...q, limit });
    return NextResponse.json(
      { results: items, total },
      // Signed URLs last an hour; the CDN may serve one response for a minute.
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("[api/listings]", error);
    return NextResponse.json({ error: "Listings are temporarily unavailable." }, { status: 503 });
  }
}
