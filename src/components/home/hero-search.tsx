/**
 * The hero search: one pill, three segments, plain GET form to /search.
 * No client JavaScript and no data fetch on the client — areas come from real
 * listing data, rendered on the server. Stacks under 768px (see home.css).
 */
const BEDROOM_OPTIONS = [
  { value: "", label: "Any" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4 or more" },
];

const RENT_OPTIONS = [
  { value: "", label: "Any" },
  { value: "500000", label: "Up to ₦500,000" },
  { value: "1000000", label: "Up to ₦1,000,000" },
  { value: "1500000", label: "Up to ₦1,500,000" },
  { value: "2000000", label: "Up to ₦2,000,000" },
  { value: "3000000", label: "Up to ₦3,000,000" },
  { value: "5000000", label: "Up to ₦5,000,000" },
];

export function HeroSearch({
  areas,
  current,
  idPrefix = "hero",
}: {
  areas: string[];
  current?: { area?: string | null; bedrooms?: number | null; maxRent?: number | null };
  idPrefix?: string;
}) {
  return (
    <form action="/search" method="get" role="search" aria-label="Find a home" className="home-search">
      <div className="home-search__seg">
        <label htmlFor={`${idPrefix}-area`}>Area</label>
        <select id={`${idPrefix}-area`} name="area" defaultValue={current?.area ?? ""}>
          <option value="">Anywhere in Enugu</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <div className="home-search__seg">
        <label htmlFor={`${idPrefix}-bedrooms`}>Bedrooms</label>
        <select id={`${idPrefix}-bedrooms`} name="bedrooms" defaultValue={current?.bedrooms != null ? String(current.bedrooms) : ""} className="data">
          {BEDROOM_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="home-search__seg">
        <label htmlFor={`${idPrefix}-rent`}>Max annual rent</label>
        <select id={`${idPrefix}-rent`} name="max_rent" defaultValue={current?.maxRent != null ? String(current.maxRent) : ""} className="data">
          {RENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="home-search__submit" aria-label="Search available homes">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}
