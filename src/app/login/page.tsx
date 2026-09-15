import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, homePathFor } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · HomeLy" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; msg?: string }>;
}) {
  const { next, msg } = await searchParams;
  const safeNext = safeNextPath(next, "");

  const session = await getSessionProfile();
  if (session) redirect(safeNext || homePathFor(session.roleTags));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">HomeLy</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">For landlords, staff and admin.</p>
      </div>
      {msg ? (
        <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-900/30 dark:text-sky-100">{msg}</p>
      ) : null}
      <LoginForm next={safeNext} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        New landlord?{" "}
        <Link href="/landlord/apply" className="underline underline-offset-4">
          Apply here
        </Link>
        .
      </p>
    </main>
  );
}
