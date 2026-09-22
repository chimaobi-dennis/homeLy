import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireStaffOrAdminPage } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";

/**
 * Every page under /admin runs this: signed-out → /login, landlord / no role → 404.
 * Staff (bd / inspector) may enter; admin-only pages add their own
 * requireAdminPage() on top (landlords list + detail).
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const viewer = await requireStaffOrAdminPage();
  const admin = isAdmin(viewer.roleTags);

  return (
    <>
      <header className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3 text-sm">
          <nav className="flex items-center gap-4">
            <span className="font-semibold">{admin ? "HomeLy admin" : "HomeLy staff"}</span>
            {admin ? (
              <>
                <Link href="/admin/landlords" className="underline underline-offset-4">
                  Landlords
                </Link>
                <Link href="/admin/staff" className="underline underline-offset-4">
                  Staff
                </Link>
                <Link href="/admin/tenants" className="underline underline-offset-4">
                  Tenants
                </Link>
                <Link href="/admin/homepage" className="underline underline-offset-4">
                  Homepage
                </Link>
              </>
            ) : null}
            <Link href="/admin/waitlist" className="underline underline-offset-4">
              Waitlist
            </Link>
            <Link href="/admin/properties" className="underline underline-offset-4">
              Properties
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-zinc-500">{viewer.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
