"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { FEES, formatNgn } from "@/lib/fees";
import { AMENITY_LABEL, furnishingLabel, isAmenity } from "@/lib/listings";
import type { PublicListingCard } from "@/lib/public-listings";

/**
 * Quick view for one listing, opened from the hero search dropdown. A native
 * <dialog> (focus trap, Escape, backdrop for free), so picking a result never
 * leaves the homepage. Shows only the anon view's columns — no address.
 */
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function ListingQuickView({
  listing,
  onClose,
  whatsappE164,
}: {
  listing: PublicListingCard | null;
  onClose: () => void;
  whatsappE164: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (listing && !d.open) d.showModal();
    else if (!listing && d.open) d.close();
  }, [listing]);

  const title = listing ? (listing.listing_headline ?? `${listing.bedrooms ?? "—"}-bedroom in ${listing.area ?? listing.city ?? "Enugu"}`) : "";
  const amenities = (listing?.amenities ?? []).filter(isAmenity);
  const rent = listing?.annual_rent ?? null;
  const oneTimeFees = rent != null ? Math.round((rent * (FEES.agencyPct + FEES.legalPct)) / 100) : null;
  const waText = listing ? encodeURIComponent(`Hello HomeLy, I'm interested in "${title}" (${listing.area ?? "Enugu"}).`) : "";

  return (
    <dialog
      ref={ref}
      className="home-quick"
      aria-labelledby="quick-view-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault(); // we close through state so React and the DOM stay in step
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // backdrop click
      }}
    >
      {listing ? (
        <div className="home-quick__inner">
          <button type="button" className="home-quick__close" onClick={onClose} aria-label="Close">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <div className="home-quick__photo">
            {listing.coverUrl ? (
              <Image src={listing.coverUrl} alt={listing.coverAlt ?? title} fill sizes="(min-width: 640px) 36rem, 100vw" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--mute)]">Photos coming</div>
            )}
            <span className="chip absolute left-3 top-3">Inspected</span>
          </div>
          <div className="home-quick__body">
            <p className="data text-2xl font-semibold">
              {formatNgn(rent)}
              <span className="text-sm font-normal text-[var(--mute)]"> / year</span>
            </p>
            <h2 id="quick-view-title" className="display mt-1 text-2xl leading-snug">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--mute)]">{listing.area ? `${listing.area} · Enugu` : (listing.city ?? "Enugu")}</p>

            <dl className="home-quick__facts">
              <div>
                <dt>Bedrooms</dt>
                <dd className="data">{listing.bedrooms ?? "—"}</dd>
              </div>
              <div>
                <dt>Bathrooms</dt>
                <dd className="data">{listing.bathrooms ?? "—"}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd className="data">{listing.size_sqm != null ? `${listing.size_sqm} m²` : "—"}</dd>
              </div>
              <div>
                <dt>Furnishing</dt>
                <dd>{furnishingLabel(listing.furnishing)}</dd>
              </div>
              <div>
                <dt>Available</dt>
                <dd className="data">{listing.available_from ? dateFmt.format(new Date(listing.available_from)) : "Not stated"}</dd>
              </div>
            </dl>

            {amenities.length ? (
              <ul className="home-quick__amenities" aria-label="Amenities">
                {amenities.map((a) => (
                  <li key={a}>{AMENITY_LABEL[a]}</li>
                ))}
              </ul>
            ) : null}

            <p className="home-quick__fees">
              One-time fees on this home: agency {FEES.agencyPct}% and legal {FEES.legalPct}% of the annual rent
              {oneTimeFees != null ? (
                <>
                  , <span className="data font-semibold text-[var(--ink)]">{formatNgn(oneTimeFees)}</span> in total
                </>
              ) : null}
              . Nothing is added at the door.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/waitlist" className="pill pill--verify">
                Join the priority list
              </Link>
              {whatsappE164 ? (
                <a href={`https://wa.me/${whatsappE164}?text=${waText}`} className="pill pill--outline" rel="noreferrer">
                  Ask on WhatsApp
                </a>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-[var(--mute)]">Applications open in a later step; for now, join the priority list to be contacted in queue order.</p>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
