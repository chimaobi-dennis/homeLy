import type { Database } from "@/lib/supabase/database.types";

export type Furnishing = Database["public"]["Enums"]["property_furnishing"];

/**
 * Fixed amenity vocabulary. MUST match `properties_amenities_allowed` in
 * migration 0016 — the DB rejects anything else. Extend both together.
 * ASSUMPTION (Step 7): this list was chosen for the Enugu market, not supplied
 * by the owner.
 */
export const AMENITIES = [
  "borehole_water",
  "prepaid_meter",
  "generator",
  "solar_inverter",
  "security_guard",
  "gated_estate",
  "fenced_compound",
  "cctv",
  "parking",
  "water_heater",
  "air_conditioning",
  "wardrobes",
  "kitchen_cabinets",
  "pop_ceiling",
  "tiled_floors",
  "balcony",
  "waste_disposal",
] as const;
export type Amenity = (typeof AMENITIES)[number];

export const AMENITY_LABEL: Record<Amenity, string> = {
  borehole_water: "Borehole water",
  prepaid_meter: "Prepaid meter",
  generator: "Generator",
  solar_inverter: "Solar / inverter",
  security_guard: "Security guard",
  gated_estate: "Gated estate",
  fenced_compound: "Fenced compound",
  cctv: "CCTV",
  parking: "Parking",
  water_heater: "Water heater",
  air_conditioning: "Air conditioning",
  wardrobes: "Built-in wardrobes",
  kitchen_cabinets: "Kitchen cabinets",
  pop_ceiling: "POP ceiling",
  tiled_floors: "Tiled floors",
  balcony: "Balcony",
  waste_disposal: "Waste disposal",
};

export function isAmenity(value: unknown): value is Amenity {
  return typeof value === "string" && (AMENITIES as readonly string[]).includes(value);
}

export const FURNISHING_OPTIONS: ReadonlyArray<{ value: Furnishing; label: string }> = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi-furnished" },
  { value: "furnished", label: "Furnished" },
];

export function furnishingLabel(value: Furnishing | null | undefined): string {
  return FURNISHING_OPTIONS.find((o) => o.value === value)?.label ?? "Not stated";
}

export const PHOTO_BUCKET = "property-photos";
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/** Object key layout: <property uuid>/<uuid>-<filename> (mirrors landlord/tenant documents). */
export function photoStoragePath(propertyId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "photo";
  return `${propertyId}/${crypto.randomUUID()}-${safe}`;
}

/**
 * What a property still needs before it can be published. Mirrors the DB
 * trigger `enforce_publish_requirements` so the UI can explain instead of
 * failing.
 */
export function publishBlockers(p: { description: string | null; target_annual_rent: number | string | null }, photoCount: number): string[] {
  const missing: string[] = [];
  if (!p.description || !p.description.trim()) missing.push("a description");
  if (!(Number(p.target_annual_rent) > 0)) missing.push("a target annual rent");
  if (photoCount < 1) missing.push("at least one photo");
  return missing;
}
