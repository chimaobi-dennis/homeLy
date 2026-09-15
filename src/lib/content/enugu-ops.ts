/**
 * PLACEHOLDER CONTENT — the owner will supply real copy.
 * Everything in square brackets is a placeholder and must be replaced before launch.
 */
export const OPS_LEAD = {
  name: "[Ops lead name]",
  title: "Head of Enugu Operations, HomeLy",
  bio:
    "[Placeholder bio — two or three sentences about who runs day-to-day operations in Enugu, " +
    "their background in property management, and how landlords can reach them.]",
  contact: "[ops phone / WhatsApp placeholder]",
} as const;

export const INSPECTION_PROCESS: ReadonlyArray<{ title: string; detail: string }> = [
  {
    title: "We confirm who you are",
    detail:
      "You upload a government ID and proof that you own the property. A member of our team checks them by hand — nothing is automated.",
  },
  {
    title: "We visit the property",
    detail:
      "An inspector from our Enugu team visits, photographs every room, and notes anything that needs fixing before a tenant moves in.",
  },
  {
    title: "We agree the plan with you",
    detail:
      "You get the inspection report, our suggested rent, and any repairs we recommend. Nothing is listed until you say yes.",
  },
  {
    title: "We list and manage",
    detail:
      "Once you sign the management agreement we market the property, screen tenants, collect rent and handle maintenance.",
  },
];
