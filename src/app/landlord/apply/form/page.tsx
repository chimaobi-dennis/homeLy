import type { Metadata } from "next";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ApplicationWizard } from "./application-wizard";

export const metadata: Metadata = { title: "Landlord application · HomeLy" };

export default async function LandlordApplyFormPage() {
  const session = await getSessionProfile();

  let existingCountry: string | null = null;
  if (session) {
    if (!session.roleTags.includes("landlord")) {
      return (
        <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
          <h1 className="text-2xl font-semibold">Staff accounts cannot apply</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            You are signed in as {session.email}, which is not a landlord account. Sign out and create a landlord
            account to apply.
          </p>
        </main>
      );
    }
    const supabase = await createClient();
    const { data } = await supabase.from("landlords").select("country_of_residence").eq("id", session.id).maybeSingle();
    existingCountry = data?.country_of_residence ?? null;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Landlord application</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {session ? "Add a property" : "Create your account and add a property"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Not read the{" "}
          <Link href="/landlord/apply" className="underline underline-offset-4">
            fees and how we work
          </Link>{" "}
          yet? Please do that first.
        </p>
      </div>
      <ApplicationWizard
        session={
          session
            ? { id: session.id, email: session.email, fullName: session.fullName, phone: session.phone }
            : null
        }
        existingCountry={existingCountry}
      />
    </main>
  );
}
