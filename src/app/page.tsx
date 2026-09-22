import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ContactForm } from "@/components/home/contact-form";
import { HeroSearch } from "@/components/home/hero-search";
import { ListingCard } from "@/components/home/listing-card";
import { PhoneVisual } from "@/components/home/phone-visual";
import { SiteNav } from "@/components/home/site-nav";
import { ABOUT, EMPTY_LISTINGS, HERO, LANDLORD_BAND, WHY_CHOOSE_US, getContactChannels } from "@/lib/content/homepage";
import { FEES } from "@/lib/fees";
import { getListingAreas, getPublicListings } from "@/lib/public-listings";
import "./home.css";

// Display serif for the homepage only; Geist (root layout) stays the body and UI sans.
const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-fraunces", axes: ["opsz", "SOFT"] });

export const metadata: Metadata = {
  title: "HomeLy",
  description: "Inspected apartments in Enugu, fees published before you commit, and a queue that rewards waiting.",
};

// Public data only (anon view, no cookies) → cacheable. Re-rendered at most once a minute.
export const revalidate = 60;

const NUMERALS = ["01", "02", "03", "04"];

export default async function Home() {
  const [areas, listings] = await Promise.all([getListingAreas(), getPublicListings({ limit: 6 })]);
  const contact = getContactChannels();
  const feeLine = `Agency ${FEES.agencyPct}% and legal ${FEES.legalPct}% of the annual rent, one-time, printed on every listing.`;

  return (
    <div className={`${fraunces.variable} home flex flex-1 flex-col`}>
      <SiteNav />

      {/* ---------------- 1. Hero ---------------- */}
      <section className="home-hero" aria-labelledby="hero-heading">
        {/* Owner-supplied aerial photo of Enugu (public/hero/enugu-aerial.jpg). Swap the file to change it;
            the veil + frosted panel keep the copy readable whatever the photo looks like. LCP element:
            priority, fill, fixed hero height → no layout shift. */}
        <Image
          src="/hero/enugu-aerial.jpg"
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="home-hero__bg"
        />
        <div className="home-hero__veil" aria-hidden="true" />
        <div className="wrap home-hero__grid">
          <div className="home-hero__copy">
            <div className="home-hero__panel">
              <h1 id="hero-heading" className="display text-[2.4rem] sm:text-[3rem] lg:text-[3.4rem]">
                {HERO.h1}
              </h1>
              <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-[var(--mute)]">{HERO.sub}</p>
              <div className="mt-7">
                <HeroSearch areas={areas} live whatsappE164={contact.whatsappE164} />
              </div>
              <p className="mt-3 text-sm text-[var(--mute)]">{HERO.micro}</p>
              <p className="mt-4 text-sm">
                <Link href="/waitlist" className="text-[var(--ink)] underline underline-offset-4">
                  {HERO.notReady}
                </Link>
              </p>
            </div>
          </div>
          <div className="home-hero__visual">
            <div className="home-hero__halo" aria-hidden="true" />
            <PhoneVisual listing={listings[0] ?? null} />
          </div>
        </div>
      </section>

      {/* ---------------- 2. Why choose us ---------------- */}
      <section className="hairline" aria-labelledby="why-heading">
        <div className="wrap py-16">
          <h2 id="why-heading" className="display max-w-[30rem] text-3xl sm:text-4xl">
            Renting the way it should already work.
          </h2>
          <ol className="home-why mt-10 list-none p-0">
            {WHY_CHOOSE_US.map((item, i) => (
              <li key={item.title} className="home-why__item reveal">
                <span className="data home-why__num" aria-hidden="true">
                  {NUMERALS[i]}
                </span>
                <div>
                  <h3 className="display text-2xl">{item.title}</h3>
                  <p className="mt-2 max-w-[32rem] text-[var(--mute)]">{i === 1 ? `${feeLine} ${item.body}` : item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- 3. About us ---------------- */}
      <section id="about" className="hairline bg-[var(--mist)]" aria-labelledby="about-heading">
        <div className="wrap grid gap-10 py-16 md:grid-cols-2 md:gap-16">
          <div className="reveal">
            <h2 id="about-heading" className="display text-3xl sm:text-4xl">
              {ABOUT.anchor.heading}
            </h2>
            <p className="mt-4 max-w-[30rem] leading-relaxed">{ABOUT.anchor.body}</p>
          </div>
          <div className="flex flex-col gap-8 reveal">
            <div>
              <h3 className="display text-2xl">{ABOUT.team.heading}</h3>
              <p className="mt-2 max-w-[30rem] text-[var(--mute)]">{ABOUT.team.body}</p>
            </div>
            <div className="hairline pt-6">
              <h3 className="display text-2xl">{ABOUT.whyEnugu.heading}</h3>
              <p className="mt-2 max-w-[30rem] text-[var(--mute)]">{ABOUT.whyEnugu.body}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 4. Available apartments ---------------- */}
      <section id="homes" className="hairline" aria-labelledby="homes-heading">
        <div className="wrap py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="homes-heading" className="display text-3xl sm:text-4xl">
              Available apartments
            </h2>
            <Link href="/search" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">
              See all
            </Link>
          </div>
          {listings.length === 0 ? (
            <p className="display mt-8 max-w-[40rem] text-2xl leading-snug sm:text-3xl">{EMPTY_LISTINGS}</p>
          ) : (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l, i) => (
                <li key={l.id} className="reveal">
                  <ListingCard listing={l} priority={i === 0} />
                </li>
              ))}
            </ul>
          )}
          {listings.length === 0 ? (
            <Link href="/waitlist" className="pill pill--verify mt-6">
              Join the priority list
            </Link>
          ) : null}
        </div>
      </section>

      {/* ---------------- 5. Landlord CTA band ---------------- */}
      <section className="home-band" aria-labelledby="landlord-heading">
        <div className="wrap flex flex-wrap items-center justify-between gap-6 py-14">
          <div>
            <h2 id="landlord-heading" className="display max-w-[30rem] text-3xl sm:text-4xl">
              {LANDLORD_BAND.heading}
            </h2>
            <p className="mt-3 max-w-[32rem] text-[color-mix(in_srgb,#fff_88%,var(--navy))]">{LANDLORD_BAND.body}</p>
          </div>
          <Link href="/landlord/apply" className="pill pill--paper">
            {LANDLORD_BAND.cta}
          </Link>
        </div>
      </section>

      {/* ---------------- 6. Contact ---------------- */}
      <section id="contact" className="hairline" aria-labelledby="contact-heading">
        <div className="wrap grid gap-10 py-16 md:grid-cols-[1fr_1.2fr] md:gap-16">
          <div>
            <h2 id="contact-heading" className="display text-3xl sm:text-4xl">
              Talk to a person
            </h2>
            <p className="mt-3 max-w-[26rem] text-[var(--mute)]">WhatsApp is the quickest way to reach the Enugu team. Email works too.</p>
            <ul className="mt-6 flex flex-col gap-3">
              <li>
                {contact.whatsappE164 ? (
                  <a href={`https://wa.me/${contact.whatsappE164}`} className="pill pill--verify" rel="noreferrer">
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

      {/* ---------------- 7. Footer ---------------- */}
      <footer className="home-footer">
        <div className="wrap grid gap-8 py-12 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="display text-2xl text-[var(--paper)]">HomeLy</p>
            <p className="mt-2 max-w-[16rem]">Inspected homes in Enugu, with fees you read before you commit.</p>
          </div>
          <nav aria-label="Tenants">
            <p className="font-semibold text-[var(--paper)]">Tenants</p>
            <ul className="mt-2 flex flex-col gap-2">
              <li>
                <Link href="/waitlist">Join the priority list</Link>
              </li>
              <li>
                <Link href="/search">Available homes</Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Landlords">
            <p className="font-semibold text-[var(--paper)]">Landlords</p>
            <ul className="mt-2 flex flex-col gap-2">
              <li>
                <Link href="/landlord/apply">Apply to have your property managed</Link>
              </li>
              <li>
                <Link href="/login">Sign in</Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="HomeLy">
            <p className="font-semibold text-[var(--paper)]">HomeLy</p>
            <ul className="mt-2 flex flex-col gap-2">
              <li>
                <a href="#about">About</a>
              </li>
              <li>
                <a href="#contact">Contact</a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
