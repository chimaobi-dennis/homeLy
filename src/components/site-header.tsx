import Link from "next/link";
import { getSessionProfile, homePathFor } from "@/lib/auth";
import { hasRole, isStaffOrAdmin } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";

/** Small header for landlord-facing pages. Shows sign-in or the signed-in email. */
export async function SiteHeader() {
  const session = await getSessionProfile();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-3 text-sm">
        <Link href="/" className="font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
          HomeLy
        </Link>
        {session ? (
          <div className="flex items-center gap-4">
            <Link href={homePathFor(session.roleTags)} className="underline underline-offset-4">
              {hasRole(session.roleTags, "landlord")
                ? "My application"
                : isStaffOrAdmin(session.roleTags)
                  ? "Admin"
                  : hasRole(session.roleTags, "tenant")
                    ? "My status"
                    : "Home"}
            </Link>
            <span className="text-zinc-500">{session.email}</span>
            <SignOutButton />
          </div>
        ) : (
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
