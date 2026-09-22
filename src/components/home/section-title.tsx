/**
 * Centred section title (reference: Sheltos `.title-3` / the accent titles on the
 * theme pages). `variant`: default = bold + light words; accent = whole title in
 * navy; light = white on a dark section.
 */
export function SectionTitle({
  bold,
  light,
  intro,
  id,
  variant = "default",
}: {
  bold: string;
  light?: string;
  intro?: string;
  id?: string;
  variant?: "default" | "accent" | "light";
}) {
  return (
    <div className={`home-title home-title--${variant}`}>
      {variant === "default" ? (
        <svg className="home-title__squiggle" viewBox="0 0 60 12" width="60" height="12" aria-hidden="true">
          <path d="M2 8c6-8 10-8 16 0s10 8 16 0 10-8 16 0 6 4 8 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : null}
      <h2 id={id}>
        {bold}
        {light ? <span> {light}</span> : null}
      </h2>
      {intro ? <p className="font-roboto">{intro}</p> : null}
    </div>
  );
}
