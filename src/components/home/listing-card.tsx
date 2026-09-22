import Image from "next/image";
import { formatNgn } from "@/lib/fees";
import type { PublicListingCard } from "@/lib/public-listings";

/**
 * Public apartment card: 16:10 photo, mono rent, area + bedrooms, Inspected chip.
 * Privacy: it only ever receives the anon view's columns, so it cannot show an
 * address even by mistake.
 */
export function ListingCard({ listing, priority = false }: { listing: PublicListingCard; priority?: boolean }) {
  const title = listing.listing_headline ?? `${listing.bedrooms ?? "—"}-bedroom in ${listing.area ?? listing.city ?? "Enugu"}`;
  return (
    <article className="home-card">
      <div className="home-card__photo">
        {listing.coverUrl ? (
          <Image
            src={listing.coverUrl}
            alt={listing.coverAlt ?? title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--mute)]">Photos coming</div>
        )}
        <span className="chip absolute left-3 top-3">Inspected</span>
      </div>
      <div className="home-card__body">
        <p className="data text-lg font-semibold">
          {formatNgn(listing.annual_rent)}
          <span className="text-xs font-normal text-[var(--mute)]"> / year</span>
        </p>
        <h3 className="mt-1 font-semibold leading-snug">{title}</h3>
        <p className="mt-1 text-sm text-[var(--mute)]">
          {listing.area ?? listing.city ?? "Enugu"} · <span className="data">{listing.bedrooms ?? "—"}</span> bed
          {listing.bathrooms != null ? (
            <>
              {" "}
              · <span className="data">{listing.bathrooms}</span> bath
            </>
          ) : null}
        </p>
      </div>
    </article>
  );
}
