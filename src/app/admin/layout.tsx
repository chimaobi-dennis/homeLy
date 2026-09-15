import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireAdminPage } from "@/lib/auth";

/** Every page under /admin runs this: signed-out → /login, non-admin → 404. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdminPage();

  return (
    <>
      <header className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3 text-sm">
          <nav className="flex items-center gap-4">
            <span className="font-semibold">HomeLy admin</span>
            <Link href="/admin/landlords" className="underline underline-offset-4">
              Landlords
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-zinc-500">{admin.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
