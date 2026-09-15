"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEmail, isPhone } from "@/lib/validation";

export type JoinWaitlistState = {
  error: string | null;
  values: { name: string; whatsapp: string; email: string };
};

/**
 * Stage 1 waitlist signup. No auth, no tenant account, no verification.
 * Inserts through the public-insert RLS policy on waitlist_entries (anon, or the
 * signed-in user if someone happens to be logged in — both are allowed).
 *
 * A duplicate email (unique index, case-insensitive) is treated as success and
 * shows the same confirmation: that covers double-clicks and resubmits without
 * telling anyone whether an address is already on the list.
 *
 * No notification of any kind is sent here — not in scope for Stage 1.
 */
export async function joinWaitlist(_prev: JoinWaitlistState, formData: FormData): Promise<JoinWaitlistState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const honeypot = String(formData.get("company") ?? "");
  const values = { name, whatsapp, email };

  if (honeypot) redirect("/waitlist/joined"); // bots fill hidden fields; humans never see it

  if (!name) return { error: "Please tell us your name.", values };
  if (!isPhone(whatsapp)) return { error: "Enter a WhatsApp number we can reach you on (digits, optional leading +).", values };
  if (!isEmail(email)) return { error: "Enter a valid email address.", values };

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_entries").insert({ name, whatsapp_number: whatsapp, email });

  if (error && error.code !== "23505") {
    console.error("[waitlist] insert failed:", error);
    return { error: "Something went wrong on our side. Please try again in a moment.", values };
  }

  redirect("/waitlist/joined");
}
