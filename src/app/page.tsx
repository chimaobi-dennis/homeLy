import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import Link from "next/link";
import { HomeExperience } from "./home-experience";
import "./home.css";

// Display serif for the homepage only. Geist (loaded in the root layout) stays
// the sans for body and UI, matching the forms behind this page.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "HomeLy",
  description:
    "Verified, inspected rental homes in Enugu. Landlords: management with fees you read first. Tenants: a priority list, no live listings yet.",
};

export default function Home() {
  return (
    <div className={`${fraunces.variable} home flex flex-1 flex-col`}>
      <header className="mx-auto flex w-full max-w-[76rem] items-center justify-between px-6 py-3 text-sm">
        <span className="text-[var(--mute)]">Enugu, Nigeria</span>
        <Link href="/login" className="underline underline-offset-4 hover:text-[var(--verify)]">
          Sign in
        </Link>
      </header>

      <HomeExperience />

      <footer className="border-t border-[var(--rule)]">
        <div className="mx-auto flex w-full max-w-[76rem] flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-[var(--mute)]">
          <span>
            <span className="display text-lg text-[var(--ink)]">HomeLy</span> — property management for Enugu
          </span>
          <nav className="flex flex-wrap gap-5">
            <Link href="/landlord/apply" className="underline underline-offset-4 hover:text-[var(--ink)]">
              For landlords
            </Link>
            <Link href="/waitlist" className="underline underline-offset-4 hover:text-[var(--ink)]">
              Tenant priority list
            </Link>
            <Link href="/login" className="underline underline-offset-4 hover:text-[var(--ink)]">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
