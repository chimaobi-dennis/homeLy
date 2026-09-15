/** HomeLy fee sheet. Shown to landlords BEFORE they apply. Percentages of annual rent. */
export const FEES = {
  /** One-time, charged when a tenant is placed. */
  agencyPct: 5,
  /** One-time, covers tenancy agreement drafting / legal. */
  legalPct: 5,
  /** Annual management fee range; exact rate agreed in the management agreement. */
  managementPctMin: 8,
  managementPctMax: 10,
} as const;

/** Default maintenance threshold in NGN. Landlord can change it during application. */
export const DEFAULT_MAINTENANCE_THRESHOLD_NGN = 150_000;

export const MIN_MAINTENANCE_THRESHOLD_NGN = 0;
export const MAX_MAINTENANCE_THRESHOLD_NGN = 50_000_000;

const ngn = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatNgn(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return ngn.format(n);
}
