import { formatNgn } from "@/lib/fees";

/**
 * The autonomous-maintenance disclosure. Shown on the landing page BEFORE
 * signup and again on the threshold step of the form. Keep the two in sync by
 * keeping them in one component.
 */
export function MaintenanceDisclosure({ thresholdNgn, compact = false }: { thresholdNgn: number; compact?: boolean }) {
  return (
    <section
      aria-labelledby="maintenance"
      className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950/30"
    >
      <h2 id="maintenance" className={compact ? "text-base font-semibold" : "text-xl font-semibold"}>
        What we do without asking you first
      </h2>
      <p className="mt-2 text-zinc-800 dark:text-zinc-200">
        HomeLy acts on its own for repairs and maintenance up to a limit that <strong>you</strong> set. The default
        is <strong>{formatNgn(thresholdNgn)}</strong> per job. You can change it during the application and later.
      </p>
      <ul className="mt-3 space-y-2 text-sm text-zinc-800 dark:text-zinc-200">
        <li>
          <strong>At or below your threshold:</strong> we fix it, pay the tradesperson, and deduct the cost from the
          next rent payment. You get a receipt and a note of what was done — after the fact.
        </li>
        <li>
          <strong>Above your threshold:</strong> we stop and contact you with a quote first. Nothing is done until you
          approve it.
        </li>
        <li>
          <strong>Emergencies</strong> (burst pipe, no power, security): we act immediately to make the property safe,
          then contact you.
        </li>
      </ul>
      {!compact ? (
        <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
          If you are not comfortable with this, set your threshold to {formatNgn(0)} and we will ask you about every
          job. Expect slower repairs if you do.
        </p>
      ) : null}
    </section>
  );
}
