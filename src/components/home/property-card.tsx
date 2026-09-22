"use client";

import Image from "next/image";
import { formatNgn } from "@/lib/fees";
import type { PublicListingCard } from "@/lib/public-listings";
import { Icon } from "./icons";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function listingTitle(l: PublicListingCard): string {
  return l.listing_headline ?? `${l.bedrooms ?? "—"}-bedroom in ${l.area ?? l.city ?? "Enugu"}`;
}

/**
 * Property card (reference: Sheltos `.property-box`): photo with label + photo count,
 * hover overlay with a quick-view button, then area, headline, rent, description,
 * bed / bath / size facts and a footer with the listed date and a "Details" button.
 * Privacy: only the anon view's columns ever reach this component.
 */
export function PropertyCard({ listing, onOpen, layout = "grid" }: { listing: PublicListingCard; onOpen: () => void; layout?: "grid" | "list" }) {
  const title = listingTitle(listing);
  return (
    <article className={`home-prop${layout === "list" ? " home-prop--list" : ""}`}>
      <div className="home-prop__image">
        {listing.coverUrl ? (
          <Image src={listing.coverUrl} alt={listing.coverAlt ?? title} fill sizes="(min-width: 1200px) 33vw, (min-width: 768px) 50vw, 100vw" className="object-cover" />
        ) : (
          <div className="home-prop__nophoto font-roboto">Photos coming</div>
        )}
        <div className="home-prop__labels">
          <span className="home-label">Inspected</span>
        </div>
        {listing.photoCount > 0 ? (
          <span className="home-prop__seen">
            <Icon name="camera" size={14} />
            <span className="data">{listing.photoCount}</span>
          </span>
        ) : null}
        <div className="home-prop__overlay">
          <button type="button" className="home-prop__round" onClick={onOpen} aria-label={`Quick view: ${title}`}>
            <Icon name="maximize" size={18} />
          </button>
        </div>
      </div>
      <div className="home-prop__details">
        <span className="home-prop__area font-roboto">{listing.area ?? listing.city ?? "Enugu"}</span>
        <h3>
          <button type="button" className="home-prop__title" onClick={onOpen}>
            {title}
          </button>
        </h3>
        <p className="home-prop__price data">
          {formatNgn(listing.annual_rent)}
          <span> / year</span>
        </p>
        {listing.description ? <p className="home-prop__desc font-roboto">{listing.description}</p> : null}
        <ul className="home-prop__facts">
          <li>
            <Icon name="bed" size={16} /> Bed : <span className="data">{listing.bedrooms ?? "—"}</span>
          </li>
          <li>
            <Icon name="bath" size={16} /> Baths : <span className="data">{listing.bathrooms ?? "—"}</span>
          </li>
          <li>
            <Icon name="ruler" size={16} /> Size : <span className="data">{listing.size_sqm != null ? `${listing.size_sqm} m²` : "—"}</span>
          </li>
        </ul>
        <div className="home-prop__foot">
          <span>{listing.listed_at ? dateFmt.format(new Date(listing.listed_at)) : "Recently listed"}</span>
          <button type="button" className="btn btn--dashed" onClick={onOpen}>
            Details
          </button>
        </div>
      </div>
    </article>
  );
}
