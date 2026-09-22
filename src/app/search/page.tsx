import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import Link from "next/link";
import { HeroSearch } from "@/components/home/hero-search";
import { ListingCard } from "@/components/home/listing-card";
import { SiteNav } from "@/components/home/site-nav";
import { formatNgn } from "@/lib/fees";
import { getListingAreas, getPublicListings, parseListingQuery } from "@/lib/public-listings";
import "../home.css";

const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-fraunces", axes: ["opsz", "SOFT"] });

export const metadata: Metadata = {
  title: "Available homes · HomeLy",
  description: "Inspected apartments in Enugu with fees published up front.",
};

/**
 * Public results page for the hero search. Reads the anon `public_listings`
 * view only (privacy-safe columns). Zero results is a first-class state that
 * points to the priority list.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ area?: string; bedrooms?: string; max_rent?: string }> }) {
  const params = await searchParams;
  const q = parseListingQuery(params);
  const [areas, listings] = await Promise.all([getListingAreas(), getPublicListings({ ...q, limit: 48 })]);

  const filters: string[] = [];
  if (q.area) filters.push(q.area);
  if (q.bedrooms != null) filters.push(q.bedrooms >= 4 ? "4 or more bedrooms" : `${q.bedrooms} bedroom${q.bedrooms > 1 ? "s" : ""}`);
  if (q.maxRent != null) filters.push(`up to ${formatNgn(q.maxRent)} a year`);

  return (
    <div className={`${fraunces.variable} home flex flex-1 flex-col`}>
      <SiteNav />
      <main className="wrap flex flex-1 flex-col gap-8 py-10">
        <div>
          <h1 className="display text-3xl sm:text-4xl">Available homes in Enugu</h1>
          <p className="mt-2 max-w-[40rem] text-[var(--mute)]">
            Every home here was inspected in person by our team. Fees are published on each listing. Applications open in a later step; for now,
            join the priority list to be contacted in queue order.
          </p>
        </div>

        <HeroSearch areas={areas} current={q} idPrefix="results" />

        <p className="text-sm text-[var(--mute)]" aria-live="polite">
          <span className="data">{listings.length}</span> {listings.length === 1 ? "home" : "homes"}
          {filters.length ? ` · ${filters.join(" · ")}` : " · all areas"}
        </p>

        {listings.length === 0 ? (
          <section className="hairline pt-8">
            <p className="display max-w-[36rem] text-2xl sm:text-3xl">
              {filters.length ? "Nothing matches those filters yet." : "The first homes are in inspection now."}
            </p>
            <p className="mt-3 max-w-[36rem] text-[var(--mute)]">
              {filters.length
                ? "Widen the search, or join the priority list and we will contact you in queue order as homes are listed."
                : "Join the priority list and you'll be first to see them."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/waitlist" className="pill pill--verify">
                Join the priority list
              </Link>
              {filters.length ? (
                <Link href="/search" className="pill pill--outline">
                  Clear filters
                </Link>
              ) : null}
            </div>
          </section>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l, i) => (
              <li key={l.id}>
                <ListingCard listing={l} priority={i < 3} />
              </li>
            ))}
          </ul>
        )}

        <p className="hairline pt-6 text-sm text-[var(--mute)]">
          Want to be told before the next one is listed?{" "}
          <Link href="/waitlist" className="text-[var(--ink)] underline underline-offset-4">
            Join the priority list
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
