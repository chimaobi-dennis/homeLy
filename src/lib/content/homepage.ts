/**
 * Homepage copy (tenant-first redesign). Facts about the team come from the
 * owner's brief; there are deliberately NO names, headshots, counts or dates
 * beyond what was supplied. Fee figures are read from src/lib/fees.ts at render.
 */

export const HERO = {
  h1: "A home in Enugu, without the agent runaround.",
  sub: "Inspected apartments, fees published before you commit, and a queue that rewards waiting — not who you know.",
  micro: "Every home is inspected in person before it goes up.",
  notReady: "Not ready to search? Join the priority list.",
} as const;

export const WHY_CHOOSE_US: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Inspected before it's listed",
    body: "A person from our Enugu team stands inside every home and photographs every room before it goes up. If it hasn't been inspected, it isn't on HomeLy.",
  },
  {
    title: "Fees in writing, before you commit",
    // The fee sentence is composed at render time from src/lib/fees.ts.
    body: "Fixed, published fees on every listing, so you know the full cost before you ask to view. Nothing is added at the door.",
  },
  {
    title: "A queue, not connections",
    body: "Your place is based on how long you've been on the priority list. Joining earlier means you hear earlier. Nobody skips the line.",
  },
  {
    title: "Rent collection and repairs, handled",
    body: "HomeLy collects rent and manages repairs on the landlord's behalf, so you deal with one accountable team rather than a chain of middlemen.",
  },
];

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
