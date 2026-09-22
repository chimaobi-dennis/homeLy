import type { Metadata } from "next";
import { Montserrat, Roboto } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/home/contact-form";
import { Icon } from "@/components/home/icons";
import { PhotoGallery } from "@/components/home/photo-gallery";
import { listingTitle } from "@/components/home/property-card";
import { PropertyGrid } from "@/components/home/property-grid";
import { ShareButtons } from "@/components/home/share-buttons";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteNav } from "@/components/home/site-nav";
import { getContactChannels } from "@/lib/content/homepage";
import { FEES, formatNgn } from "@/lib/fees";
import { AMENITY_LABEL, furnishingLabel, isAmenity } from "@/lib/listings";
import { getPublicListingById, getPublicListings, isUuid } from "@/lib/public-listings";
import "../../home.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-montserrat" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-roboto" });

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Public data only; each property page is cached for a minute.
export const revalidate = 60;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const listing = isUuid(id) ? await getPublicListingById(id) : null;
  if (!listing) return { title: "Home not found · HomeLy" };
  const title = listingTitle(listing);
  return {
    title: `${title} · HomeLy`,
    description: listing.description ?? `${title}. ${formatNgn(listing.annual_rent)} a year, inspected by HomeLy.`,
  };
}

/**
 * Property page (reference: Sheltos "property / thumbnail-image"): title card
 * with facts, share/print; gallery with thumbnails; Property Details list;
 * Fees; Features; Related properties; sidebar with Contact info, Request a
 * viewing and Recently added. Reads the anon view only — no address, no landlord.
 */
export default async function HomePage({ params }: { params: Params }) {
  const { id } = await params;
  const listing = await getPublicListingById(id);
  if (!listing) notFound();

  const title = listingTitle(listing);
  const contact = getContactChannels();
  const amenities = (listing.amenities ?? []).filter(isAmenity);
  const rent = listing.annual_rent;
  const oneTimeFees = rent != null ? Math.round((rent * (FEES.agencyPct + FEES.legalPct)) / 100) : null;

  const [sameArea, newest] = await Promise.all([
    listing.area ? getPublicListings({ area: listing.area, limit: 4 }) : Promise.resolve([]),
    getPublicListings({ limit: 6 }),
  ]);
  const related = [...sameArea, ...newest].filter((l, i, arr) => l.id !== listing.id && arr.findIndex((x) => x.id === l.id) === i).slice(0, 3);
  const recent = newest.filter((l) => l.id !== listing.id).slice(0, 3);

  const details: Array<[string, string]> = [
    ["Property ID", listing.id.slice(0, 8).toUpperCase()],
    ["Rent", `${formatNgn(rent)} / year`],
    ["Status", "Inspected · available"],
    ["Area", listing.area ?? "—"],
    ["City", listing.city ?? "Enugu"],
    ["Bedrooms", listing.bedrooms != null ? String(listing.bedrooms) : "—"],
    ["Bathrooms", listing.bathrooms != null ? String(listing.bathrooms) : "—"],
    ["Size", listing.size_sqm != null ? `${listing.size_sqm} m²` : "—"],
    ["Furnishing", furnishingLabel(listing.furnishing)],
    ["Available from", listing.available_from ? dateFmt.format(new Date(listing.available_from)) : "Not stated"],
    ["Listed", listing.listed_at ? dateFmt.format(new Date(listing.listed_at)) : "—"],
    ["Photos", String(listing.photos.length)],
  ];

  return (
    <div className={`${montserrat.variable} ${roboto.variable} home flex flex-1 flex-col`}>
      <SiteNav variant="solid" />

      {/* Title card (reference .single-title) */}
      <section className="home-single__top">
        <div className="wrap">
          <div className="home-single__card">
            <div className="home-single__left">
              <div className="home-single__heading">
                <h1>{title}</h1>
                <span className="home-label">Inspected</span>
              </div>
              <p className="home-single__addr font-roboto">
                {listing.area ? `${listing.area}, ` : ""}
                {listing.city ?? "Enugu"} · exact address shared with verified tenants
              </p>
              <ul className="home-single__facts">
                <li>
                  <Icon name="bed" size={16} /> <span className="data">{listing.bedrooms ?? "—"}</span> Bedrooms
                </li>
                <li>
                  <Icon name="bath" size={16} /> <span className="data">{listing.bathrooms ?? "—"}</span> Bathrooms
                </li>
                <li>
                  <Icon name="ruler" size={16} /> <span className="data">{listing.size_sqm != null ? `${listing.size_sqm} m²` : "—"}</span>
                </li>
                <li>
                  <Icon name="sofa" size={16} /> {furnishingLabel(listing.furnishing)}
                </li>
                {listing.available_from ? (
                  <li>
                    <Icon name="calendar" size={16} /> From <span className="data">{dateFmt.format(new Date(listing.available_from))}</span>
                  </li>
                ) : null}
              </ul>
              <ShareButtons title={title} />
            </div>
            <div className="home-single__right">
              <p className="home-single__price data">
                {formatNgn(rent)} <span>/ year</span>
              </p>
              {amenities.length ? (
                <ul className="home-single__tags">
                  {amenities.slice(0, 3).map((a) => (
                    <li key={a}>{AMENITY_LABEL[a]}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <main className="wrap home-single">
        <div className="home-single__main">
          {/* Gallery */}
          <section className="home-single__section" aria-labelledby="gallery-heading">
            <h4 id="gallery-heading" className="home-single__h4">
              Gallery
            </h4>
            <PhotoGallery photos={listing.photos} title={title} />
          </section>

          {/* Property details */}
          <section className="home-single__section" aria-labelledby="details-heading">
            <h4 id="details-heading" className="home-single__h4">
              Property details
            </h4>
            {listing.description ? <p className="home-single__desc font-roboto">{listing.description}</p> : null}
            <ul className="home-single__list">
              {details.map(([k, v]) => (
                <li key={k}>
                  <span>{k} :</span> <span className="data">{v}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Fees (our version of "Property brief") */}
          <section className="home-single__section" aria-labelledby="fees-heading">
            <h4 id="fees-heading" className="home-single__h4">
              Fees, in writing
            </h4>
            <div className="home-single__brief">
              <p className="font-roboto">
                One-time on placement: agency {FEES.agencyPct}% and legal {FEES.legalPct}% of the annual rent
                {oneTimeFees != null ? (
                  <>
                    , <span className="data home-accent">{formatNgn(oneTimeFees)}</span> on this home
                  </>
                ) : null}
                .
              </p>
              <p className="font-roboto">Nothing is added at the door. There is no caution fee and no agent commission on top of this.</p>
              <p className="font-roboto">Rent is collected and repairs are coordinated by HomeLy, so you deal with one accountable team.</p>
            </div>
          </section>

          {/* Features */}
          {amenities.length ? (
            <section className="home-single__section" aria-labelledby="features-heading">
              <h4 id="features-heading" className="home-single__h4">
                Features
              </h4>
              <ul className="home-single__features">
                {amenities.map((a) => (
                  <li key={a}>
                    <Icon name="check" size={16} /> {AMENITY_LABEL[a]}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Related */}
          {related.length ? (
            <section className="home-single__section" aria-labelledby="related-heading">
              <h2 id="related-heading" className="home-single__h2">
                Related homes
              </h2>
              <PropertyGrid listings={related} columns="3" />
            </section>
          ) : null}
        </div>

        {/* Sidebar (reference .single-sidebar) */}
        <aside className="home-sidebar home-sidebar--single" aria-label="Contact and more homes">
          <div className="home-adv">
            <h6 className="home-adv__head">Contact info</h6>
            <div className="home-agent">
              <span className="home-agent__avatar" aria-hidden="true">
                <Icon name="user" size={26} />
              </span>
              <div>
                <p className="home-agent__name">HomeLy Enugu team</p>
                <p className="home-agent__meta font-roboto">Inspected this home in person</p>
              </div>
            </div>
            <ul className="home-cat home-cat--info">
              <li>
                <span>
                  <Icon name="map-pin" size={15} /> Enugu, Nigeria
                </span>
              </li>
              {contact.whatsappE164 ? (
                <li>
                  <a href={`https://wa.me/${contact.whatsappE164}?text=${encodeURIComponent(`Hello HomeLy, I'm interested in "${title}" (${listing.area ?? "Enugu"}).`)}`} rel="noreferrer">
                    <Icon name="phone" size={15} /> <span className="data">+{contact.whatsappE164}</span>
                  </a>
                </li>
              ) : null}
              {contact.email ? (
                <li>
                  <a href={`mailto:${contact.email}`}>
                    <Icon name="mail" size={15} /> {contact.email}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
          <div className="home-adv">
            <h6 className="home-adv__head">Request a viewing</h6>
            <ContactForm compact submitLabel="Submit request" defaultMessage={`I'd like to view "${title}" in ${listing.area ?? "Enugu"}.`} />
            <p className="mt-3 text-xs text-[var(--soft)] font-roboto">Applications open in a later step; viewings are arranged in priority-list order.</p>
          </div>
          {recent.length ? (
            <div className="home-adv">
              <h6 className="home-adv__head">Recently added</h6>
              <ul className="home-recent">
                {recent.map((l) => (
                  <li key={l.id}>
                    <Link href={`/homes/${l.id}`} className="home-recent__thumb">
                      {l.coverUrl ? <Image src={l.coverUrl} alt="" fill sizes="80px" className="object-cover" /> : null}
                    </Link>
                    <span className="min-w-0">
                      <Link href={`/homes/${l.id}`} className="home-recent__title">
                        {listingTitle(l)}
                      </Link>
                      <span className="home-recent__price data">{formatNgn(l.annual_rent)} / year</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </main>

      <SiteFooter />
    </div>
  );
}
