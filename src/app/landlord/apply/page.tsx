import type { Metadata } from "next";
import Link from "next/link";
import { INSPECTION_PROCESS, OPS_LEAD } from "@/lib/content/enugu-ops";
import { DEFAULT_MAINTENANCE_THRESHOLD_NGN, FEES, formatNgn } from "@/lib/fees";
import { MaintenanceDisclosure } from "./maintenance-disclosure";

export const metadata: Metadata = {
  title: "Apply as a landlord · HomeLy",
  description: "Who we are, how the inspection works, what it costs, and what we do without asking — before you fill in anything.",
};

/**
 * Trust-first landing. Everything a landlord should know BEFORE any input field:
 * who runs Enugu ops, the inspection process, the fee sheet, and the autonomous
 * maintenance disclosure. The form itself lives at /landlord/apply/form.
 */
export default function LandlordApplyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-12">
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          For landlords in Enugu
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Let HomeLy manage your property</h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Read this page first. It tells you who we are, how we work, what it costs and what we will do on your
          behalf without asking. Then apply — it takes about five minutes.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="#apply"
            className="rounded-md bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800"
          >
            Read on, then apply
          </Link>
          <Link href="/login" className="rounded-md border border-zinc-300 px-5 py-2.5 font-medium dark:border-zinc-700">
            Already applied? Sign in
          </Link>
        </div>
      </section>

      <section aria-labelledby="ops" className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 id="ops" className="text-xl font-semibold">Who runs Enugu operations</h2>
        <div className="mt-4 flex items-start gap-4">
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          >
            ?
          </div>
          <div>
            <p className="font-medium">{OPS_LEAD.name}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{OPS_LEAD.title}</p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{OPS_LEAD.bio}</p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Reach the team: {OPS_LEAD.contact}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          Placeholder copy — real name, photo and bio to follow.
        </p>
      </section>

      <section aria-labelledby="process">
        <h2 id="process" className="text-xl font-semibold">How the inspection works</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Nothing is listed until a person from our team has checked your documents and seen the property.
        </p>
        <ol className="mt-4 space-y-4">
          {INSPECTION_PROCESS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="fees">
        <h2 id="fees" className="text-xl font-semibold">What it costs</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          All fees are a percentage of the annual rent. There is nothing to pay until a tenant is placed.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium">Fee</th>
                <th className="py-2 pr-4 font-medium">Rate</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              <tr>
                <td className="py-2 pr-4">Agency fee</td>
                <td className="py-2 pr-4">{FEES.agencyPct}% of annual rent</td>
                <td className="py-2">One-time, when a tenant is placed</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Legal fee</td>
                <td className="py-2 pr-4">{FEES.legalPct}% of annual rent</td>
                <td className="py-2">One-time, covers the tenancy agreement</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Management fee</td>
                <td className="py-2 pr-4">
                  {FEES.managementPctMin}–{FEES.managementPctMax}% of annual rent
                </td>
                <td className="py-2">Every year, for as long as we manage the property</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Example: on {formatNgn(2_000_000)} a year, the one-time fees are {formatNgn(200_000)} and the annual
          management fee is {formatNgn(160_000)}–{formatNgn(200_000)}. The exact management rate is fixed in your
          agreement before anything is listed.
        </p>
      </section>

      <MaintenanceDisclosure thresholdNgn={DEFAULT_MAINTENANCE_THRESHOLD_NGN} />

      <section id="apply" className="rounded-xl bg-emerald-700 p-6 text-white">
        <h2 className="text-xl font-semibold">Ready to apply?</h2>
        <p className="mt-2 text-emerald-50">
          You will create an account, tell us about one property, set your maintenance threshold, and upload your
          ID and proof of ownership. You can add more properties later.
        </p>
        <Link
          href="/landlord/apply/form"
          className="mt-4 inline-block rounded-md bg-white px-5 py-2.5 font-medium text-emerald-800 hover:bg-emerald-50"
        >
          Start the application
        </Link>
      </section>
    </main>
  );
}
