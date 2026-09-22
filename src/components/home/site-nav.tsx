import Link from "next/link";
import { Icon } from "./icons";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Available homes" },
  { href: "/landlord/apply", label: "For landlords" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

/**
 * Transparent header laid over the hero / page banner (reference: Sheltos header).
 * No session read, so the pages stay cacheable. Under 992px the menu folds into a
 * <details> hamburger — no JavaScript needed.
 */
export function SiteNav() {
  return (
    <header className="home-nav">
      <div className="wrap home-nav__row">
        <Link href="/" className="home-nav__brand">
          HomeLy
        </Link>
        <nav aria-label="Primary" className="home-nav__menu">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="home-nav__right">
          <Link href="/login" className="home-nav__signin">
            <Icon name="user" size={18} />
            <span>Sign in</span>
          </Link>
          <details className="home-nav__mobile">
            <summary aria-label="Menu">
              <Icon name="menu" size={22} />
            </summary>
            <nav aria-label="Primary (mobile)">
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
              <Link href="/login">Sign in</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
