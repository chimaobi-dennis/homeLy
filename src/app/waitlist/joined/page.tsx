import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "You're on the list · HomeLy" };

/** Confirmation after joining. Plain about what exists today and what happens next. */
export default function WaitlistJoinedPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">HomeLy · Enugu</p>
      <h1 className="text-3xl font-semibold tracking-tight">You&apos;re on the priority list.</h1>
      <div className="space-y-3 text-zinc-700 dark:text-zinc-300">
        <p>
          <strong>There are no live listings yet.</strong> We are still inspecting and preparing homes in Enugu.
        </p>
        <p>
          When the official queue opens, we will notify you by email or WhatsApp and tell you exactly what happens next.
          Priority goes in the order people joined.
        </p>
        <p>Nothing else is needed from you now. You can close this page.</p>
      </div>
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to HomeLy
      </Link>
    </main>
  );
}
