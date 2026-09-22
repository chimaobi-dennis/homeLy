import type { Metadata } from "next";
import { Montserrat, Roboto } from "next/font/google";
import Link from "next/link";
import { CompareBar } from "@/components/home/compare-bar";
import { PropertyGrid } from "@/components/home/property-grid";
import { SavedRedirect } from "@/components/home/saved-redirect";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteNav } from "@/components/home/site-nav";
import { getPublicListings, isUuid } from "@/lib/public-listings";
import "../home.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-montserrat" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-roboto" });

export const metadata: Metadata = { title: "Saved homes · HomeLy", robots: { index: false } };

/** Saved homes (favourites). Ids come from the browser (localStorage) via the query string. */
export default async function SavedPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids: raw } = await searchParams;
  const ids = (raw ?? "").split(",").map((s) => s.trim()).filter(isUuid).slice(0, 50);
  const listings = ids.length ? await getPublicListings({ ids, limit: 50 }) : [];
  const missing = ids.length - listings.length;

  return (
    <div className={`${montserrat.variable} ${roboto.variable} home flex flex-1 flex-col`}>
      <SiteNav variant="solid" />
      <main className="wrap home-page">
        <div className="home-page__head">
          <h1>Saved homes</h1>
          <p className="font-roboto">Homes you tapped the heart on. They are kept in this browser only.</p>
        </div>
        {ids.length === 0 ? (
          <SavedRedirect />
        ) : listings.length === 0 ? (
          <div className="home-zero">
            <h3>None of your saved homes are listed any more.</h3>
            <p className="font-roboto">They may have been let. Browse what is available now.</p>
            <div className="mt-5">
              <Link href="/search" className="btn btn--gradient btn--pill">
                Browse available homes
              </Link>
            </div>
          </div>
        ) : (
          <>
            {missing > 0 ? (
              <p className="mb-6 font-roboto text-[var(--mute)]">
                <span className="data">{missing}</span> saved {missing === 1 ? "home is" : "homes are"} no longer listed.
              </p>
            ) : null}
            <PropertyGrid listings={listings} columns="3" />
          </>
        )}
      </main>
      <SiteFooter />
      <CompareBar />
    </div>
  );
}
