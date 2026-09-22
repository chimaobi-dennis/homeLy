import Link from "next/link";
import { formatNgn } from "@/lib/fees";
import type { PublicListingCard } from "@/lib/public-listings";
import { CardActions } from "./card-actions";
import { CardSlider } from "./card-slider";
import { Icon } from "./icons";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function listingTitle(l: { listing_headline: string | null; bedrooms: number | null; area: string | null; city: string | null }): string {
  return l.listing_headline ?? `${l.bedrooms ?? "—"}-bedroom in ${l.area ?? l.city ?? "Enugu"}`;
}

export function listingHref(id: string): string {
  return `/homes/${id}`;
}

/**
 * Listing card (reference: Sheltos `.property-box`): rounded card, photo slider
 * with arrows + dots, label + photo count, compare + favourite buttons, then
 * area, headline, rent, description, bed / bath / size and a footer with the
 * listed date and a "Details" button. Same card everywhere.
 * Privacy: only the anon view's columns reach this component.
 */
export function PropertyCard({ listing, layout = "grid", priority = false }: { listing: PublicListingCard; layout?: "grid" | "list"; priority?: boolean }) {
  const title = listingTitle(listing);
  const href = listingHref(listing.id);
  return (
    <article className={`home-prop${layout === "list" ? " home-prop--list" : ""}`}>
      <div className="home-prop__image">
        <CardSlider photos={listing.photos} title={title} href={href} priority={priority} />
        <div className="home-prop__labels">
          <span className="home-label">Inspected</span>
        </div>
        {listing.photoCount > 0 ? (
          <span className="home-prop__seen">
            <Icon name="camera" size={14} />
            <span className="data">{listing.photoCount}</span>
          </span>
        ) : null}
        <CardActions id={listing.id} title={title} />
      </div>
      <div className="home-prop__details">
        <span className="home-prop__area font-roboto">{listing.area ?? listing.city ?? "Enugu"}</span>
        <h3>
          <Link href={href} className="home-prop__title">
            {title}
          </Link>
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
          <Link href={href} className="btn btn--dashed">
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}
