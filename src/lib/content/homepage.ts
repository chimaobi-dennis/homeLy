/**
 * Homepage copy. Facts about the team come from the owner's brief; there are
 * deliberately NO names, headshots, counts or dates beyond what was supplied.
 * Layout follows the owner's chosen reference (Sheltos "slider-filter-search"
 * hero + "corporate" services section) — see the decision log in CLAUDE.md.
 * Fee figures are read from src/lib/fees.ts at render.
 */

/** Text slides in the hero (the background photo stays; the copy slides, like the reference). */
export const HERO_SLIDES: ReadonlyArray<{ eyebrow: string; title: string; cta: { label: string; href: string } }> = [
  {
    eyebrow: "Looking for a home in Enugu?",
    title: "Inspected homes, fees in writing, no agent runaround.",
    cta: { label: "Join the priority list", href: "/waitlist" },
  },
  {
    eyebrow: "Own property in Enugu but live somewhere else?",
    title: "We verify, inspect, list and manage it for you.",
    cta: { label: "For landlords", href: "/landlord/apply" },
  },
];

export const LOOKING_FOR = {
  heading: "What are you looking for?",
  items: [
    { label: "Rent a home", href: "/search", icon: "home" },
    { label: "Priority list", href: "/waitlist", icon: "list" },
    { label: "Manage my property", href: "/landlord/apply", icon: "key" },
  ] as ReadonlyArray<{ label: string; href: string; icon: "home" | "list" | "key" }>,
} as const;

/**
 * "Why choose HomeLy" slides (reference: the card + media block; the card itself
 * slides between messages). PLACEHOLDER COPY — the owner will write the final
 * words; keep the structure (tag, heading, paragraph, button) per slide. The
 * media next to it comes from /admin/homepage.
 */
export const WHY_HOMELY_SLIDES: ReadonlyArray<{ tag: string; heading: string; body: string; cta: { label: string; href: string } }> = [
  {
    tag: "#Inspected",
    heading: "Worried about finding a home in Enugu?",
    body: "We know how it feels. A person from our Enugu team stands inside every home and photographs every room before it goes up. If it hasn't been inspected, it isn't on HomeLy.",
    cta: { label: "Search now", href: "/search" },
  },
  {
    tag: "#FeesInWriting",
    heading: "Tired of fees that appear at the door?",
    body: "Fixed, published fees on every listing, so you know the full cost before you ask to view. Nothing is added at the door, and there is no agent commission on top.",
    cta: { label: "See available homes", href: "/search" },
  },
  {
    tag: "#TheQueue",
    heading: "A queue, not connections.",
    body: "Your place is based on how long you've been on the priority list. Joining earlier means you hear earlier. Nobody skips the line.",
    cta: { label: "Join the priority list", href: "/waitlist" },
  },
];

/** "Property of the day" band. PLACEHOLDER intro — owner to rewrite. */
export const PROPERTY_OF_DAY = {
  heading: "Property of the day",
  intro: "One inspected home in Enugu, picked by the HomeLy team.",
} as const;

/** "Latest property listing" title. PLACEHOLDER intro — owner to rewrite. */
export const LATEST_LISTING = {
  heading: "Latest property listing",
  intro: "Inspected homes in Enugu, newest first. Fees are published on every listing.",
} as const;

export const ABOUT = {
  anchor: {
    heading: "Who runs things on the ground",
    body: "HomeLy's Enugu operations are anchored by a civil engineer with more than ten years in property and construction, based in Enugu. Inspections, repairs and landlord visits happen in person, by someone who can read a building.",
  },
  team: {
    heading: "A remote-first team",
    body: "Product, support and the queue are run remotely by a small team; only the work that needs boots on the ground happens in Enugu. That keeps fees fixed and lets us publish them.",
  },
  whyEnugu: {
    heading: "Why Enugu",
    body: "Enugu has a large rental market, many owners who live outside the state, and a lot of homes still let by word of mouth. That gap between owners who are away and renters who are waiting is what HomeLy is built to close.",
  },
} as const;

export const EMPTY_LISTINGS =
  "The first homes are in inspection now. Join the priority list and you'll be first to see them.";

export const LANDLORD_BAND = {
  heading: "Own property in Enugu but live somewhere else?",
  body: "HomeLy verifies, inspects, lists and manages it for you, with a fee sheet you read before you sign anything.",
  cta: "For landlords",
} as const;

/** Contact channels are configured, never invented. Unset → the channel is simply not shown. */
export function getContactChannels(): { whatsappE164: string | null; email: string | null } {
  const wa = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? "").replace(/[^0-9]/g, "");
  const email = (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "").trim();
  return { whatsappE164: wa.length >= 10 ? wa : null, email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null };
}
