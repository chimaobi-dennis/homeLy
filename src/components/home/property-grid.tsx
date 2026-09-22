"use client";

import { useState } from "react";
import type { PublicListingCard } from "@/lib/public-listings";
import { ListingQuickView } from "./listing-quick-view";
import { PropertyCard } from "./property-card";

/** Grid of property cards plus the single quick-view dialog they open. */
export function PropertyGrid({
  listings,
  columns,
  whatsappE164,
}: {
  listings: PublicListingCard[];
  columns: "2" | "3" | "list";
  whatsappE164: string | null;
}) {
  const [selected, setSelected] = useState<PublicListingCard | null>(null);
  return (
    <>
      <ul className={`home-prop-grid home-prop-grid--${columns}`}>
        {listings.map((l) => (
          <li key={l.id}>
            <PropertyCard listing={l} onOpen={() => setSelected(l)} layout={columns === "list" ? "list" : "grid"} />
          </li>
        ))}
      </ul>
      <ListingQuickView listing={selected} onClose={() => setSelected(null)} whatsappE164={whatsappE164} />
    </>
  );
}
