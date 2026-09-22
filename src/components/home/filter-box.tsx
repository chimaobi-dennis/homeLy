import { FURNISHING_OPTIONS, RENT_RANGE, ROOM_OPTIONS, SIZE_RANGE } from "@/lib/listings";
import type { ListingQuery } from "@/lib/public-listings";
import { RangeSlider } from "./range-slider";

/**
 * The filter form (reference: Sheltos `app-filter-box`). Plain GET to /search so it
 * works before JavaScript loads. `variant="dark"` is the glass box on the hero;
 * `variant="light"` is the sidebar card on /search. Same fields in both places.
 */
export function FilterBox({
  areas,
  current,
  variant,
  idPrefix,
  keep,
}: {
  areas: string[];
  current?: ListingQuery;
  variant: "dark" | "light";
  idPrefix: string;
  /** Params to carry through unchanged (sort, view) when the form is re-submitted. */
  keep?: Record<string, string | undefined>;
}) {
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <form action="/search" method="get" role="search" aria-label="Find a home" className={`home-filter home-filter--${variant}`}>
      {Object.entries(keep ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}

      <div className="home-filter__group">
        <label htmlFor={id("q")}>Keyword</label>
        <input id={id("q")} name="q" type="search" maxLength={60} autoComplete="off" placeholder="Area, street name or keyword" defaultValue={current?.q ?? ""} />
      </div>

      <div className="home-filter__group">
        <label htmlFor={id("area")}>Area</label>
        <select id={id("area")} name="area" defaultValue={current?.area ?? ""}>
          <option value="">Anywhere in Enugu</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="home-filter__group">
        <label htmlFor={id("furnishing")}>Furnishing</label>
        <select id={id("furnishing")} name="furnishing" defaultValue={current?.furnishing ?? ""}>
          <option value="">Any</option>
          {FURNISHING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="home-filter__row">
        <div className="home-filter__group">
          <label htmlFor={id("bedrooms")}>Bed</label>
          <select id={id("bedrooms")} name="bedrooms" defaultValue={current?.bedrooms != null ? String(current.bedrooms) : ""}>
            <option value="">Any</option>
            {ROOM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="home-filter__group">
          <label htmlFor={id("bathrooms")}>Bath</label>
          <select id={id("bathrooms")} name="bathrooms" defaultValue={current?.bathrooms != null ? String(current.bathrooms) : ""}>
            <option value="">Any</option>
            {ROOM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="home-filter__group">
        <RangeSlider
          label="Rent / year"
          minName="min_rent"
          maxName="max_rent"
          min={RENT_RANGE.min}
          max={RENT_RANGE.max}
          step={RENT_RANGE.step}
          defaultMin={current?.minRent}
          defaultMax={current?.maxRent}
          unit="ngn"
        />
      </div>
      <div className="home-filter__group">
        <RangeSlider
          label="Size"
          minName="min_size"
          maxName="max_size"
          min={SIZE_RANGE.min}
          max={SIZE_RANGE.max}
          step={SIZE_RANGE.step}
          defaultMin={current?.minSize}
          defaultMax={current?.maxSize}
          unit="sqm"
        />
      </div>

      <button type="submit" className={`btn btn--gradient${variant === "light" ? " btn--pill" : ""}`}>
        Search
      </button>
    </form>
  );
}
