import Link from "next/link";
import { formatNgn } from "@/lib/fees";
import type { PublicListingCard } from "@/lib/public-listings";
import { Icon } from "./icons";
import { MediaSlider } from "./media-slider";
import { listingTitle } from "./property-card";

/**
 * "Property of the day" card (reference: the split card — photo slider left,
 * details right: accented headline, area line, description, icon facts, rent
 * and a View property button). Public columns only.
 */
export function FeaturedProperty({ listing }: { listing: PublicListingCard }) {
  const title = listingTitle(listing);
  const words = title.split(" ");
  const accent = words.slice(0, 2).join(" ");
  const rest = words.slice(2).join(" ");
  const href = `/homes/${listing.id}`;

  return (
    <article className="home-potd__card">
      <div className="home-potd__media">
        <MediaSlider items={listing.photos.map((p) => ({ kind: "image" as const, url: p.url, alt: p.alt ?? title }))} sizes="(min-width: 992px) 50vw, 100vw" className="home-potd__slider" />
      </div>
      <div className="home-potd__body">
        <div className="home-potd__head">
          <h3>
            <span>{accent}</span>
            {rest ? ` ${rest}` : ""}
          </h3>
          <p className="home-potd__addr">
            {listing.area ? `${listing.area}, ` : ""}
            {listing.city ?? "Enugu"}
          </p>
          {listing.description ? <p className="home-potd__desc font-roboto">{listing.description}</p> : null}
        </div>
        <ul className="home-potd__facts">
          <li className="home-potd__fact">
            <i>
              <Icon name="bed" size={22} />
            </i>
            <span>
              <span className="data">{listing.bedrooms ?? "—"}</span> {listing.bedrooms === 1 ? "Bedroom" : "Bedrooms"}
            </span>
          </li>
          <li className="home-potd__fact">
            <i>
              <Icon name="bath" size={22} />
            </i>
            <span>
              <span className="data">{listing.bathrooms ?? "—"}</span> {listing.bathrooms === 1 ? "Bathroom" : "Bathrooms"}
            </span>
          </li>
          <li className="home-potd__fact home-potd__fact--pill data">{listing.size_sqm != null ? `${listing.size_sqm} m²` : "Size not stated"}</li>
        </ul>
        <div className="home-potd__foot">
          <p className="home-potd__price data">
            {formatNgn(listing.annual_rent)}
            <small>Home for rent · per year</small>
          </p>
          <Link href={href} className="btn btn--gradient btn--pill home-potd__cta">
            View property
          </Link>
        </div>
      </div>
    </article>
  );
}
