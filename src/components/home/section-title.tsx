/** Centred section title (reference: Sheltos `.title-3`): squiggle, bold + light words, intro line. */
export function SectionTitle({ bold, light, intro, id }: { bold: string; light: string; intro?: string; id?: string }) {
  return (
    <div className="home-title">
      <svg className="home-title__squiggle" viewBox="0 0 60 12" width="60" height="12" aria-hidden="true">
        <path d="M2 8c6-8 10-8 16 0s10 8 16 0 10-8 16 0 6 4 8 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h2 id={id}>
        {bold} <span>{light}</span>
      </h2>
      {intro ? <p className="font-roboto">{intro}</p> : null}
    </div>
  );
}
