import type { Metadata } from "next";
import { Montserrat, Roboto } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { CompareBar } from "@/components/home/compare-bar";
import { Icon } from "@/components/home/icons";
import { listingTitle } from "@/components/home/property-card";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteNav } from "@/components/home/site-nav";
import { FEES, formatNgn } from "@/lib/fees";
import { AMENITIES, AMENITY_LABEL, furnishingLabel, isAmenity } from "@/lib/listings";
import { getPublicListings, isUuid } from "@/lib/public-listings";
import "../home.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-montserrat" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-roboto" });

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const metadata: Metadata = { title: "Compare homes · HomeLy", robots: { index: false } };

/** Side-by-side comparison of 2–3 listed homes (ids from the compare selection). Public columns only. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids: raw } = await searchParams;
  const ids = [...new Set((raw ?? "").split(",").map((s) => s.trim()).filter(isUuid))].slice(0, 3);
  const found = ids.length ? await getPublicListings({ ids, limit: 3 }) : [];
  const homes = ids.map((id) => found.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => Boolean(l));
  const amenitiesInPlay = AMENITIES.filter((a) => homes.some((h) => (h.amenities ?? []).filter(isAmenity).includes(a)));

  const rows: Array<[string, (h: (typeof homes)[number]) => string]> = [
    ["Area", (h) => h.area ?? "—"],
    ["Rent / year", (h) => formatNgn(h.annual_rent)],
    [`One-time fees (${FEES.agencyPct}% + ${FEES.legalPct}%)`, (h) => (h.annual_rent != null ? formatNgn(Math.round((h.annual_rent * (FEES.agencyPct + FEES.legalPct)) / 100)) : "—")],
    ["Bedrooms", (h) => (h.bedrooms != null ? String(h.bedrooms) : "—")],
    ["Bathrooms", (h) => (h.bathrooms != null ? String(h.bathrooms) : "—")],
    ["Size", (h) => (h.size_sqm != null ? `${h.size_sqm} m²` : "—")],
    ["Furnishing", (h) => furnishingLabel(h.furnishing)],
    ["Available from", (h) => (h.available_from ? dateFmt.format(new Date(h.available_from)) : "Not stated")],
    ["Listed", (h) => (h.listed_at ? dateFmt.format(new Date(h.listed_at)) : "—")],
  ];

  return (
    <div className={`${montserrat.variable} ${roboto.variable} home flex flex-1 flex-col`}>
      <SiteNav variant="solid" />
      <main className="wrap home-page">
        <div className="home-page__head">
          <h1>Compare homes</h1>
          <p className="font-roboto">Side by side, from the same published details every visitor sees.</p>
        </div>

        {homes.length < 2 ? (
          <div className="home-zero">
            <h3>Pick at least two homes to compare.</h3>
            <p className="font-roboto">Use the compare button on any listing card, then come back here.</p>
            <div className="mt-5">
              <Link href="/search" className="btn btn--gradient btn--pill">
                Browse available homes
              </Link>
            </div>
          </div>
        ) : (
          <div className="home-compare">
            <table className="home-compare__table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Detail</span>
                  </th>
                  {homes.map((h) => (
                    <th key={h.id} scope="col">
                      <Link href={`/homes/${h.id}`} className="home-compare__photo">
                        {h.coverUrl ? <Image src={h.coverUrl} alt="" fill sizes="(min-width: 768px) 30vw, 90vw" className="object-cover" /> : null}
                      </Link>
                      <Link href={`/homes/${h.id}`} className="home-compare__title">
                        {listingTitle(h)}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, get]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {homes.map((h) => (
                      <td key={h.id} className="data">
                        {get(h)}
                      </td>
                    ))}
                  </tr>
                ))}
                {amenitiesInPlay.map((a) => (
                  <tr key={a}>
                    <th scope="row">{AMENITY_LABEL[a]}</th>
                    {homes.map((h) => {
                      const has = (h.amenities ?? []).includes(a);
                      return (
                        <td key={h.id} className={has ? "is-yes" : "is-no"}>
                          {has ? <Icon name="check" size={16} /> : <span aria-hidden="true">—</span>}
                          <span className="sr-only">{has ? "Yes" : "No"}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <th scope="row">
                    <span className="sr-only">Open</span>
                  </th>
                  {homes.map((h) => (
                    <td key={h.id}>
                      <Link href={`/homes/${h.id}`} className="btn btn--dashed">
                        Details
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </main>
      <SiteFooter />
      <CompareBar />
    </div>
  );
}
