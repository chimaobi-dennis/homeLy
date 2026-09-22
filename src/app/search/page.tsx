import type { Metadata } from "next";
import { Montserrat, Roboto } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { FilterBox } from "@/components/home/filter-box";
import { Icon } from "@/components/home/icons";
import { PropertyGrid } from "@/components/home/property-grid";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteNav } from "@/components/home/site-nav";
import { SortSelect } from "@/components/home/sort-select";
import { getContactChannels } from "@/lib/content/homepage";
import { formatNgn } from "@/lib/fees";
import { getAreaCounts, getPublicListings, getPublicListingsPage, parseListingQuery, parsePage, parseView, type ListingSearchParams } from "@/lib/public-listings";
import "../home.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-montserrat" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-roboto" });

export const metadata: Metadata = {
  title: "Available homes · HomeLy",
  description: "Inspected apartments in Enugu with fees published up front.",
};

const PER_PAGE = 6;

/**
 * Results page (reference: Sheltos listing "grid view / 2 grid / left sidebar").
 * Banner → sidebar (filter, areas, contact, recently added) + results (sort, view
 * toggles, cards, pagination). Reads the anon `public_listings` view only.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<ListingSearchParams> }) {
  const params = await searchParams;
  const q = parseListingQuery(params);
  const page = parsePage(params.page);
  const view = parseView(params.view);
  const contact = getContactChannels();

  const [areaCounts, result, recent] = await Promise.all([
    getAreaCounts(),
    getPublicListingsPage({ ...q, limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    getPublicListings({ limit: 3 }),
  ]);
  const { items, total } = result;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  // Current params as strings (for links that change one thing and keep the rest).
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v !== "") base[k] = v;
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(base);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `/search?${s}` : "/search";
  };
  const hasFilters = Boolean(q.q || q.area || q.bedrooms || q.bathrooms || q.furnishing || q.minRent || q.maxRent || q.minSize || q.maxSize);

  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);

  return (
    <div className={`${montserrat.variable} ${roboto.variable} home flex flex-1 flex-col`}>
      <SiteNav />

      {/* Banner (reference: breadcrumb section) */}
      <section className="home-banner">
        <Image src="/hero/enugu-aerial.jpg" alt="" fill priority sizes="100vw" className="home-banner__bg" />
        <div className="home-banner__overlay" aria-hidden="true" />
        <div className="wrap home-banner__content">
          <h1>Available homes</h1>
          <nav aria-label="Breadcrumb">
            <ol className="home-crumbs">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li aria-hidden="true">
                <Icon name="chevrons-right" size={14} />
              </li>
              <li aria-current="page">Available homes</li>
            </ol>
          </nav>
        </div>
      </section>

      <main className="wrap home-listing">
        {/* Left sidebar */}
        <aside className="home-sidebar" aria-label="Search filters">
          <div className="home-adv">
            <h5 className="home-adv__title">Advance search</h5>
          </div>
          <div className="home-adv">
            <h6 className="home-adv__head">Filter</h6>
            <FilterBox areas={areaCounts.map((a) => a.area)} current={q} variant="light" idPrefix="side" keep={{ sort: base.sort, view: base.view }} />
          </div>
          <div className="home-adv">
            <h6 className="home-adv__head">Areas</h6>
            {areaCounts.length ? (
              <ul className="home-cat">
                {areaCounts.map((a) => (
                  <li key={a.area}>
                    <Link href={href({ area: a.area, page: undefined })} aria-current={q.area === a.area ? "true" : undefined}>
                      <Icon name="arrow-right" size={14} />
                      <span>{a.area}</span>
                      <span className="data home-cat__count">({a.count})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--mute)]">Areas appear as homes are listed.</p>
            )}
          </div>
          {contact.whatsappE164 || contact.email ? (
            <div className="home-adv">
              <h6 className="home-adv__head">Contact info</h6>
              <ul className="home-cat home-cat--info">
                <li>
                  <span>
                    <Icon name="map-pin" size={15} /> Enugu, Nigeria
                  </span>
                </li>
                {contact.whatsappE164 ? (
                  <li>
                    <a href={`https://wa.me/${contact.whatsappE164}`} rel="noreferrer">
                      <Icon name="phone" size={15} /> <span className="data">+{contact.whatsappE164}</span>
                    </a>
                  </li>
                ) : null}
                {contact.email ? (
                  <li>
                    <a href={`mailto:${contact.email}`}>
                      <Icon name="mail" size={15} /> {contact.email}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
          {recent.length ? (
            <div className="home-adv">
              <h6 className="home-adv__head">Recently added</h6>
              <ul className="home-recent">
                {recent.map((l) => (
                  <li key={l.id}>
                    <span className="home-recent__thumb">
                      {l.coverUrl ? <Image src={l.coverUrl} alt="" fill sizes="80px" className="object-cover" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="home-recent__title">{l.listing_headline ?? `${l.bedrooms ?? "—"}-bedroom in ${l.area ?? "Enugu"}`}</span>
                      <span className="home-recent__price data">{formatNgn(l.annual_rent)} / year</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>

        {/* Results */}
        <section className="home-results" aria-labelledby="results-heading">
          <div className="home-results__head">
            <div>
              <h2 id="results-heading">Available homes</h2>
              <p className="font-roboto" aria-live="polite">
                Showing <span className="data home-accent">{from}-{to}</span> of <span className="data home-accent">{total}</span> {total === 1 ? "home" : "homes"}
                {q.q ? <> for “{q.q}”</> : null}
              </p>
            </div>
            <div className="home-results__tools">
              <SortSelect current={q.sort ?? "newest"} params={base} />
              <ul className="home-views" aria-label="Layout">
                {(
                  [
                    ["2", "grid-2", "Two columns"],
                    ["3", "grid-3", "Three columns"],
                    ["list", "list-view", "List"],
                  ] as const
                ).map(([v, icon, label]) => (
                  <li key={v}>
                    <Link href={href({ view: v })} className={view === v ? "is-active" : undefined} aria-label={label} aria-current={view === v ? "true" : undefined}>
                      <Icon name={icon} size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {total === 0 ? (
            <div className="home-zero">
              <h3>{hasFilters ? "Nothing matches those filters yet." : "The first homes are in inspection now."}</h3>
              <p className="font-roboto">
                {hasFilters
                  ? "Widen the search, or join the priority list and we will contact you in queue order as homes are listed."
                  : "Join the priority list and you'll be first to see them."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/waitlist" className="btn btn--gradient btn--pill">
                  Join the priority list
                </Link>
                {hasFilters ? (
                  <Link href="/search" className="btn btn--dashed">
                    Clear filters
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <PropertyGrid listings={items} columns={view} whatsappE164={contact.whatsappE164} />
          )}

          {pages > 1 ? (
            <nav className="home-pages" aria-label="Pagination">
              <ul>
                <li>
                  {page > 1 ? (
                    <Link href={href({ page: page - 1 === 1 ? undefined : String(page - 1) })} aria-label="Previous page">
                      « Previous
                    </Link>
                  ) : (
                    <span aria-disabled="true">« Previous</span>
                  )}
                </li>
                {pageNumbers.map((n, i) => (
                  <li key={n}>
                    {i > 0 && pageNumbers[i - 1] !== n - 1 ? <span className="home-pages__gap">…</span> : null}
                    {n === page ? (
                      <span aria-current="page" className="is-active data">
                        {n}
                      </span>
                    ) : (
                      <Link href={href({ page: n === 1 ? undefined : String(n) })} className="data" aria-label={`Page ${n}`}>
                        {n}
                      </Link>
                    )}
                  </li>
                ))}
                <li>
                  {page < pages ? (
                    <Link href={href({ page: String(page + 1) })} aria-label="Next page">
                      Next »
                    </Link>
                  ) : (
                    <span aria-disabled="true">Next »</span>
                  )}
                </li>
              </ul>
            </nav>
          ) : null}

          <p className="home-results__note font-roboto">
            Applications open in a later step. Want to be told before the next home is listed?{" "}
            <Link href="/waitlist" className="underline underline-offset-4">
              Join the priority list
            </Link>
            .
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
