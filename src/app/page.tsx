import type { Metadata } from "next";
import { Montserrat, Roboto } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { CompareBar } from "@/components/home/compare-bar";
import { ContactForm } from "@/components/home/contact-form";
import { FilterBox } from "@/components/home/filter-box";
import { FeaturedProperty } from "@/components/home/featured-property";
import { HeroSlider } from "@/components/home/hero-slider";
import { LookingFor } from "@/components/home/looking-for";
import { PropertyGrid } from "@/components/home/property-grid";
import { SectionTitle } from "@/components/home/section-title";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteNav } from "@/components/home/site-nav";
import { WhySlider } from "@/components/home/why-slider";
import { ABOUT, EMPTY_LISTINGS, HERO_SLIDES, LANDLORD_BAND, LATEST_LISTING, PROPERTY_OF_DAY, WHY_HOMELY_SLIDES, getContactChannels } from "@/lib/content/homepage";
import { getFeaturedListing, getListingAreas, getPublicListings } from "@/lib/public-listings";
import { getHomepageMedia } from "@/lib/site-media";
import "./home.css";

// Reference typography: Montserrat for everything, Roboto for descriptive paragraphs.
const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-montserrat" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-roboto" });

export const metadata: Metadata = {
  title: "HomeLy",
  description: "Inspected apartments in Enugu, fees published before you commit, and a queue that rewards waiting.",
};

// Public data only (anon view, no cookies) → cacheable. Re-rendered at most once a minute.
export const revalidate = 60;

export default async function Home() {
  const [areas, listings, featured, media] = await Promise.all([getListingAreas(), getPublicListings({ limit: 6 }), getFeaturedListing(), getHomepageMedia()]);
  const contact = getContactChannels();
  // Until the admin uploads media, the slider shows the hero photo so the section is never empty.
  const mediaItems = media.length ? media.map((m) => ({ kind: m.kind, url: m.url, caption: m.caption })) : [{ kind: "image" as const, url: "/hero/enugu-aerial.jpg", alt: "" }];

  return (
    <div className={`${montserrat.variable} ${roboto.variable} home flex flex-1 flex-col`}>
      <SiteNav />

      {/* ---------------- 1. Hero: photo + text slider + "looking for" tiles + filter box ---------------- */}
      <section className="home-hero" aria-labelledby="hero-heading">
        <Image src="/hero/enugu-aerial.jpg" alt="" fill priority fetchPriority="high" sizes="100vw" quality={60} className="home-hero__bg" />
        <div className="home-hero__overlay" aria-hidden="true" />
        <div className="wrap home-hero__row">
          <div className="home-hero__left">
            <HeroSlider slides={HERO_SLIDES} />
            <LookingFor />
          </div>
          <div className="home-hero__right">
            <FilterBox areas={areas} variant="dark" idPrefix="hero" />
          </div>
        </div>
      </section>

      {/* ---------------- 2. Why choose HomeLy: text card + admin-uploaded image/video slider ---------------- */}
      <section className="home-why" aria-labelledby="why-heading">
        <WhySlider slides={WHY_HOMELY_SLIDES} media={mediaItems} headingId="why-heading" />
      </section>

      {/* ---------------- 3. Property of the day ---------------- */}
      {featured ? (
        <section className="home-potd" aria-labelledby="potd-heading">
          <Image src="/hero/enugu-aerial.jpg" alt="" fill sizes="100vw" quality={60} className="home-potd__bg" />
          <div className="home-potd__overlay" aria-hidden="true" />
          <div className="wrap">
            <SectionTitle id="potd-heading" bold={PROPERTY_OF_DAY.heading} intro={PROPERTY_OF_DAY.intro} variant="light" />
            <FeaturedProperty listing={featured} />
          </div>
        </section>
      ) : null}

      {/* ---------------- 4. Latest property listing ---------------- */}
      <section id="homes" className="home-section" aria-labelledby="homes-heading">
        <div className="wrap">
          <SectionTitle id="homes-heading" bold={LATEST_LISTING.heading} intro={LATEST_LISTING.intro} variant="accent" />
          {listings.length === 0 ? (
            <p className="home-empty font-roboto">{EMPTY_LISTINGS}</p>
          ) : (
            <PropertyGrid listings={listings} columns="3" />
          )}
          <div className="mt-10 flex justify-center">
            <Link href={listings.length === 0 ? "/waitlist" : "/search"} className="btn btn--gradient">
              {listings.length === 0 ? "Join the priority list" : "View all homes"}
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- 5. About us (owner content; kept below the reference sections) ---------------- */}
      <section id="about" className="home-section home-section--tint" aria-labelledby="about-heading">
        <div className="wrap grid gap-10 md:grid-cols-2 md:gap-16">
          <div className="reveal">
            <h2 id="about-heading" className="home-h2">
              {ABOUT.anchor.heading}
            </h2>
            <p className="mt-4 max-w-[30rem] font-roboto leading-relaxed">{ABOUT.anchor.body}</p>
          </div>
          <div className="flex flex-col gap-8 reveal">
            <div>
              <h3 className="home-h3">{ABOUT.team.heading}</h3>
              <p className="mt-2 max-w-[30rem] font-roboto text-[var(--mute)]">{ABOUT.team.body}</p>
            </div>
            <div className="hairline pt-6">
              <h3 className="home-h3">{ABOUT.whyEnugu.heading}</h3>
              <p className="mt-2 max-w-[30rem] font-roboto text-[var(--mute)]">{ABOUT.whyEnugu.body}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 6. Landlord CTA band ---------------- */}
      <section className="home-band" aria-labelledby="landlord-heading">
        <div className="wrap flex flex-wrap items-center justify-between gap-6 py-14">
          <div>
            <h2 id="landlord-heading" className="home-h2 max-w-[30rem]">
              {LANDLORD_BAND.heading}
            </h2>
            <p className="mt-3 max-w-[32rem] font-roboto text-[color-mix(in_srgb,#fff_88%,var(--navy))]">{LANDLORD_BAND.body}</p>
          </div>
          <Link href="/landlord/apply" className="btn btn--white">
            {LANDLORD_BAND.cta}
          </Link>
        </div>
      </section>

      {/* ---------------- 7. Contact ---------------- */}
      <section id="contact" className="home-section" aria-labelledby="contact-heading">
        <div className="wrap grid gap-10 md:grid-cols-[1fr_1.2fr] md:gap-16">
          <div>
            <h2 id="contact-heading" className="home-h2">
              Talk to a person
            </h2>
            <p className="mt-3 max-w-[26rem] font-roboto text-[var(--mute)]">WhatsApp is the quickest way to reach the Enugu team. Email works too.</p>
            <ul className="mt-6 flex flex-col gap-3">
              <li>
                {contact.whatsappE164 ? (
                  <a href={`https://wa.me/${contact.whatsappE164}`} className="btn btn--gradient" rel="noreferrer">
                    WhatsApp us
                  </a>
                ) : (
                  <span className="text-sm text-[var(--mute)]">WhatsApp number to be published.</span>
                )}
              </li>
              <li>
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-sm text-[var(--mute)]">Email address to be published.</span>
                )}
              </li>
            </ul>
          </div>
          <div>
            <ContactForm />
          </div>
        </div>
      </section>

      <SiteFooter />
      <CompareBar />
    </div>
  );
}
