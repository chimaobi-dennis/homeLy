import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistForm } from "./waitlist-form";

export const metadata: Metadata = {
  title: "Tenant waitlist · HomeLy",
  description: "Verified, inspected rental homes in Enugu are coming. Leave your details to be first to hear when the official queue opens.",
};

/**
 * Stage 1: public, no login, three fields. Tenants have no account at this
 * stage by design — there is deliberately no "check my status" page.
 */
export default function WaitlistPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          HomeLy · Enugu
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Be first to hear about verified homes in Enugu</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          HomeLy is preparing inspected, landlord-verified rental homes in Enugu. There are no live listings yet.
          Leave your details and you will be on the priority list — we will contact you by email or WhatsApp when the
          official queue opens.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <li>· No account and no password — just three fields.</li>
          <li>· No fees to join.</li>
          <li>· Nothing else is needed from you until we get in touch.</li>
        </ul>
      </div>

      <WaitlistForm />

      <p className="text-sm text-zinc-500">
        Own a property in Enugu?{" "}
        <Link href="/landlord/apply" className="underline underline-offset-4">
          Landlords start here
        </Link>
        .
      </p>
    </main>
  );
}
