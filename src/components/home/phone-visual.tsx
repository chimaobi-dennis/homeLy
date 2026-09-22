import Image from "next/image";
import { formatNgn } from "@/lib/fees";
import type { PublicListingCard } from "@/lib/public-listings";

/**
 * The hero visual: a hand-held phone built in CSS showing the real HomeLy
 * apartment card. No stock photography. Static (no animation), fixed aspect
 * ratio (no layout shift). SWAPPABLE: pass `photoSrc` to replace the entire
 * screen with a commissioned photo later without touching the hero layout.
 */
export function PhoneVisual({ listing, photoSrc }: { listing: PublicListingCard | null; photoSrc?: string }) {
  return (
    <div className="home-phone" role="img" aria-label="HomeLy on a phone, showing an inspected apartment listing">
      <div className="home-phone__screen">
        <div className="home-phone__notch" aria-hidden="true" />
        {photoSrc ? (
          <Image src={photoSrc} alt="" fill sizes="(min-width: 768px) 320px, 78vw" className="object-cover" priority />
        ) : (
          <>
            <div className="home-phone__bar" aria-hidden="true">
              <span className="display text-base text-[var(--ink)]">HomeLy</span>
              <span className="data">Enugu</span>
            </div>
            <div className="home-phone__card" aria-hidden="true">
              <div className="home-phone__photo">
                {listing?.coverUrl ? (
                  <Image src={listing.coverUrl} alt="" fill sizes="300px" className="object-cover" priority />
                ) : null}
                <span className="chip absolute left-2 top-2">Inspected</span>
              </div>
              <div className="p-3">
                <p className="data text-sm font-semibold">
                  {listing ? formatNgn(listing.annual_rent) : "Rent published"}
                  <span className="text-[10px] font-normal text-[var(--mute)]">{listing ? " / year" : " on every listing"}</span>
                </p>
                <p className="mt-0.5 text-xs font-semibold leading-snug">
                  {listing ? (listing.listing_headline ?? `${listing.bedrooms}-bedroom in ${listing.area ?? "Enugu"}`) : "Inspected apartment"}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--mute)]">
                  {listing ? `${listing.area ?? listing.city ?? "Enugu"} · ${listing.bedrooms ?? "—"} bed` : "Area · bedrooms · fees in writing"}
                </p>
              </div>
            </div>
            <div className="mx-3.5 mt-1 rounded-[var(--radius)] border border-[var(--rule)] p-3" aria-hidden="true">
              <p className="text-[11px] font-semibold">Your place in the queue is kept.</p>
              <p className="mt-0.5 text-[10px] text-[var(--mute)]">We contact you in queue order.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
