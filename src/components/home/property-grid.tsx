import type { PublicListingCard } from "@/lib/public-listings";
import { PropertyCard } from "./property-card";

/** Grid of property cards; every card links to its property page. */
export function PropertyGrid({ listings, columns }: { listings: PublicListingCard[]; columns: "2" | "3" | "list" }) {
  return (
    <ul className={`home-prop-grid home-prop-grid--${columns}`}>
      {listings.map((l) => (
        <li key={l.id}>
          <PropertyCard listing={l} layout={columns === "list" ? "list" : "grid"} />
        </li>
      ))}
    </ul>
  );
}
