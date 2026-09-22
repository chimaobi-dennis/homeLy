import Link from "next/link";

/** Navy footer shared by the public pages. */
export function SiteFooter() {
  return (
    <footer className="home-footer">
      <div className="wrap grid gap-8 py-12 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="home-footer__brand">HomeLy</p>
          <p className="mt-2 max-w-[16rem]">Inspected homes in Enugu, with fees you read before you commit.</p>
        </div>
        <nav aria-label="Tenants">
          <p className="home-footer__head">Tenants</p>
          <ul className="mt-2 flex flex-col gap-2">
            <li>
              <Link href="/waitlist">Join the priority list</Link>
            </li>
            <li>
              <Link href="/search">Available homes</Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Landlords">
          <p className="home-footer__head">Landlords</p>
          <ul className="mt-2 flex flex-col gap-2">
            <li>
              <Link href="/landlord/apply">Apply to have your property managed</Link>
            </li>
            <li>
              <Link href="/login">Sign in</Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="HomeLy">
          <p className="home-footer__head">HomeLy</p>
          <ul className="mt-2 flex flex-col gap-2">
            <li>
              <Link href="/#about">About</Link>
            </li>
            <li>
              <Link href="/#contact">Contact</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
