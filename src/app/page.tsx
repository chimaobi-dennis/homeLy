import type { Metadata } from "next";
import { Montserrat, Roboto } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ContactForm } from "@/components/home/contact-form";
import { FilterBox } from "@/components/home/filter-box";
import { HeroSlider } from "@/components/home/hero-slider";
import { Icon } from "@/components/home/icons";
import { LookingFor } from "@/components/home/looking-for";
import { PropertyGrid } from "@/components/home/property-grid";
import { SectionTitle } from "@/components/home/section-title";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteNav } from "@/components/home/site-nav";
import { ABOUT, EMPTY_LISTINGS, HERO_SLIDES, LANDLORD_BAND, SERVICES, getContactChannels } from "@/lib/content/homepage";
import { FEES } from "@/lib/fees";
import { getListingAreas, getPublicListings } from "@/lib/public-listings";
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
  const [areas, listings] = await Promise.all([getListingAreas(), getPublicListings({ limit: 6 })]);
  const contact = getContactChannels();
  const feeLine = `Agency ${FEES.agencyPct}% and legal ${FEES.legalPct}% of the annual rent, one-time, printed on every listing.`;

  return (
    <div className={`${montserrat.variable} ${roboto.variable} home flex flex-1 flex-col`}>
      <SiteNav />

      {/* ---------------- 1. Hero: photo + text slider + "looking for" tiles + filter box ---------------- */}
      <section className="home-hero" aria-labelledby="hero-heading">
        <Image src="/hero/enugu-aerial.jpg" alt="" fill priority fetchPriority="high" sizes="100vw" className="home-hero__bg" />
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

      {/* ---------------- 2. Provided services ---------------- */}
      <section className="home-section" aria-labelledby="services-heading">
        <div className="wrap">
          <SectionTitle id="services-heading" bold={SERVICES.bold} light={SERVICES.light} intro={SERVICES.intro} />
          <ul className="home-services">
            {SERVICES.items.map((s, i) => (
              <li key={s.title} className="home-service reveal">
                <span className="home-service__line" aria-hidden="true" />
                <Icon name={s.icon} size={50} strokeWidth={1.2} className="home-service__icon" />
                <h3>{s.title}</h3>
                <p className="font-roboto">{i === 1 ? `${feeLine} ${s.body}` : s.body}</p>
                <Link href={s.cta.href} className="btn btn--flat">
                  {s.cta.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------- 3. About us ---------------- */}
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

      {/* ---------------- 4. Available apartments ---------------- */}
      <section id="homes" className="home-section" aria-labelledby="homes-heading">
        <div className="wrap">
          <SectionTitle id="homes-heading" bold="Available" light="apartments" intro="Every home here was inspected in person by our team. Fees are published on each listing." />
          {listings.length === 0 ? (
            <p className="home-empty font-roboto">{EMPTY_LISTINGS}</p>
          ) : (
            <PropertyGrid listings={listings} columns="3" whatsappE164={contact.whatsappE164} />
          )}
          <div className="mt-10 flex justify-center">
            <Link href={listings.length === 0 ? "/waitlist" : "/search"} className="btn btn--gradient">
              {listings.length === 0 ? "Join the priority list" : "View all homes"}
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- 5. Landlord CTA band ---------------- */}
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

      {/* ---------------- 6. Contact ---------------- */}
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
    </div>
  );
}
