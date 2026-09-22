import Link from "next/link";

/** Static header for the public homepage/search pages (no session read, so the page can be cached). */
export function SiteNav() {
  return (
    <header className="home-nav border-b border-[var(--rule)]">
      <div className="wrap flex min-h-14 items-center justify-between gap-4 py-2 text-sm">
        <Link href="/" className="display text-2xl leading-none text-[var(--ink)]">
          HomeLy
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-5">
          <Link href="/search" className="hidden min-h-11 items-center underline-offset-4 hover:underline sm:inline-flex">
            Available homes
          </Link>
          <Link href="/landlord/apply" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            For landlords
          </Link>
          <Link href="/login" className="inline-flex min-h-11 items-center text-[var(--mute)] underline-offset-4 hover:underline">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
