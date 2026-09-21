import Link from "next/link";
import { INSPECTION_PROCESS, OPS_LEAD } from "@/lib/content/enugu-ops";
import { DEFAULT_MAINTENANCE_THRESHOLD_NGN, FEES, formatNgn } from "@/lib/fees";

/*
 * Persona sections rendered below the hero. Static content only; every number
 * here comes from src/lib/fees.ts or src/lib/content/enugu-ops.ts. Anything the
 * owner has not supplied yet is shown as the codebase's own placeholder and
 * labelled as such — nothing is invented.
 */

const EXAMPLE_RENT = 2_000_000; // worked example only; the same example the /landlord/apply page uses

export function LandlordContent() {
  const oneTime = (EXAMPLE_RENT * (FEES.agencyPct + FEES.legalPct)) / 100;
  const mgmtMin = (EXAMPLE_RENT * FEES.managementPctMin) / 100;
  const mgmtMax = (EXAMPLE_RENT * FEES.managementPctMax) / 100;

  return (
    <section className="mx-auto w-full max-w-[76rem] px-6 pb-20 pt-8" aria-labelledby="landlords-heading">
      <h2 id="landlords-heading" className="display max-w-[40rem] text-[1.9rem] sm:text-[2.4rem]">
        What you get, what it costs, and what we will do without asking — before you fill in anything.
      </h2>

      <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
        {/* ---- Who runs Enugu ops ---- */}
        <div>
          <h3 className="text-lg font-semibold">Who runs Enugu operations</h3>
          <div className="home-quote mt-4">
            <p className="display text-[1.35rem]">{OPS_LEAD.name}</p>
            <p className="mt-1 text-sm text-[var(--mute)]">{OPS_LEAD.title}</p>
            <p className="mt-3 max-w-[32rem] leading-relaxed">{OPS_LEAD.bio}</p>
            <p className="mt-3 text-sm text-[var(--mute)]">Reach the team: {OPS_LEAD.contact}</p>
          </div>
          {/* TODO(owner): replace the placeholder name, bio and contact in src/lib/content/enugu-ops.ts. */}
          <p className="mt-3 text-xs text-[var(--mute)]">Placeholder — real name, photo and bio to follow.</p>

          <h3 className="mt-12 text-lg font-semibold">How the inspection works</h3>
          <p className="mt-2 max-w-[32rem] text-[var(--mute)]">
            In this order, every time. Nothing is listed until a person has done all four.
          </p>
          <ol className="home-steps mt-4 max-w-[32rem]">
            {INSPECTION_PROCESS.map((step) => (
              <li key={step.title}>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--mute)]">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ---- Fee sheet + maintenance disclosure ---- */}
        <div>
          <h3 className="text-lg font-semibold">The fee sheet</h3>
          <p className="mt-2 text-[var(--mute)]">
            Every fee is a percentage of the annual rent. There is nothing to pay until a tenant is placed.
          </p>
          <table className="home-ledger mt-4">
            <thead>
              <tr>
                <th scope="col">Fee</th>
                <th scope="col">Rate</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Agency</td>
                <td>{FEES.agencyPct}% of annual rent</td>
                <td>Once, when a tenant is placed</td>
              </tr>
              <tr>
                <td>Legal</td>
                <td>{FEES.legalPct}% of annual rent</td>
                <td>Once, covers the tenancy agreement</td>
              </tr>
              <tr>
                <td>Management</td>
                <td>
                  {FEES.managementPctMin}–{FEES.managementPctMax}% of annual rent
                </td>
                <td>Every year we manage the property</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-sm text-[var(--mute)]">
            On {formatNgn(EXAMPLE_RENT)} a year: {formatNgn(oneTime)} once, then {formatNgn(mgmtMin)}–{formatNgn(mgmtMax)} a year.
            The exact management rate is fixed in your agreement before anything is listed.
          </p>

          <div className="home-panel mt-10">
            <h3 className="text-lg font-semibold">What we do without asking you first</h3>
            <p className="mt-2 leading-relaxed">
              HomeLy acts on its own for repairs up to a limit <strong>you</strong> set — the default is{" "}
              <strong>{formatNgn(DEFAULT_MAINTENANCE_THRESHOLD_NGN)}</strong> per job. At or below it we fix, pay, deduct
              from the next rent and send you the receipt. Above it we stop and send you a quote first. Emergencies we
              make safe immediately, then call you.
            </p>
            <p className="mt-3 text-sm text-[var(--mute)]">
              Set the limit to {formatNgn(0)} and we ask about every job. You can change it during the application and
              later.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-14 flex flex-wrap items-center gap-5">
        <Link href="/landlord/apply" className="home-btn home-btn--verify">
          Start my landlord application
        </Link>
        <Link href="/login" className="text-sm underline underline-offset-4 hover:text-[var(--verify)]">
          Already applied? Sign in
        </Link>
      </div>
    </section>
  );
}

export function TenantContent() {
  return (
    <section className="mx-auto w-full max-w-[76rem] px-6 pb-20 pt-8" aria-labelledby="tenants-heading">
      <h2 id="tenants-heading" className="display max-w-[40rem] text-[1.9rem] sm:text-[2.4rem]">
        The straight answer: there is nothing to view yet, and the list is real.
      </h2>

      <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
        <div>
          <p className="display text-[1.3rem]">No live listings</p>
          <p className="mt-2 leading-relaxed text-[var(--mute)]">
            HomeLy is verifying landlords and inspecting homes in Enugu right now. We do not show a home until a person
            from our team has stood inside it.
          </p>
        </div>
        <div>
          <p className="display text-[1.3rem]">A priority list, in order</p>
          <p className="mt-2 leading-relaxed text-[var(--mute)]">
            Your place is based on how long you have been on the list. Joining earlier means you hear earlier — that is
            the whole mechanism.
          </p>
        </div>
        <div>
          <p className="display text-[1.3rem]">You will hear from us</p>
          <p className="mt-2 leading-relaxed text-[var(--mute)]">
            When the official queue opens we notify you by email or WhatsApp and tell you exactly what happens next.
            Nothing else is needed from you until then.
          </p>
        </div>
      </div>

      <div className="mt-12 max-w-[40rem] border-t border-[var(--rule)] pt-6">
        <p className="font-semibold">What we ask for</p>
        <p className="mt-1 text-[var(--mute)]">
          Your name, a WhatsApp number and an email. No account, no password, no fees. We use them only to contact
          you about HomeLy homes.
        </p>
        {/* TODO(owner): no launch date or home count is published anywhere in the codebase — none is invented here. */}
        <p className="mt-3 text-sm text-[var(--mute)]">We do not publish a launch date yet. We will not pretend to.</p>
      </div>

      <div className="mt-10">
        <Link href="/waitlist" className="home-btn home-btn--ink">
          Put me on the priority list
        </Link>
      </div>
    </section>
  );
}
