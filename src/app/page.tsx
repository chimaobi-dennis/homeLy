import Link from "next/link";

const routes = [
  { href: "/landlord/apply", label: "Landlord application", who: "landlords" },
  { href: "/waitlist", label: "Tenant priority list", who: "renters, no account needed" },
] as const;

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          HomeLy
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Property management for Enugu
        </h1>
        <p className="mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
          Landlord onboarding, the tenant priority list and staff invites are live. Staff join by invite link only.
        </p>
      </div>
      <p className="text-sm">
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>{" "}
        <span className="text-zinc-500">(landlords, staff, admin)</span>
      </p>
      <ul className="flex w-full max-w-md flex-col gap-2">
        {routes.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <span className="font-medium">{r.label}</span>
              <span className="text-sm text-zinc-500">{r.who}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
