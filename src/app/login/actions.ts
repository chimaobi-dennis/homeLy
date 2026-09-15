"use server";

import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isEmail, safeNextPath } from "@/lib/validation";

export type SignInState = { error: string | null };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"), "");

  if (!isEmail(email) || !password) {
    return { error: "Enter your email address and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    // A deactivated (auth-banned) staff account knows its own password; tell it plainly.
    if (error?.message.toLowerCase().includes("banned")) {
      return { error: "This account has been deactivated. Contact a HomeLy admin." };
    }
    return { error: "Email or password is incorrect." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role_tags")
    .eq("id", data.user.id)
    .maybeSingle();

  redirect(next || homePathFor(profile?.role_tags ?? []));
}
