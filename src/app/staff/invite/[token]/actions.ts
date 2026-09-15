"use server";

import { redirect } from "next/navigation";
import { inviteState, isInviteToken, type InviteState } from "@/lib/invites";
import { notifyByEmail } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requiredText } from "@/lib/validation";

export type AcceptInviteState = {
  error: string | null;
  /** Set when the invite turned out not to be acceptable, so the form can show the right state. */
  inviteState?: Exclude<InviteState, "valid">;
};

const STATE_MESSAGE: Record<Exclude<InviteState, "valid">, string> = {
  accepted: "This invite has already been used.",
  revoked: "This invite was revoked by an admin.",
  expired: "This invite has expired.",
};

/**
 * Accept a staff invite: create the auth user through the Admin API (the
 * self-service sign-up path would make them a landlord), with
 * app_metadata.role_tags copied from the invite, then sign them in.
 *
 * The token is claimed atomically (pending → accepted, only if still valid)
 * BEFORE the user is created, so two simultaneous submissions cannot both
 * succeed; if user creation then fails the claim is reverted.
 */
export async function acceptStaffInvite(_prev: AcceptInviteState, formData: FormData): Promise<AcceptInviteState> {
  const token = String(formData.get("token") ?? "");
  const fullName = requiredText(formData.get("fullName"), "Your name", 120);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!isInviteToken(token)) return { error: "This invite link is not valid." };
  if (typeof fullName !== "string") return { error: fullName.error };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("staff_invites")
    .select("id, email, role_tags, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite) return { error: "This invite link is not valid." };

  const state = inviteState(invite);
  if (state !== "valid") return { error: STATE_MESSAGE[state], inviteState: state };

  // Claim the token first (single use, race-safe).
  const { data: claimed } = await admin
    .from("staff_invites")
    .update({ status: "accepted" })
    .eq("id", invite.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (!claimed) return { error: "This invite was just used or has expired. Ask an admin for a new link.", inviteState: "expired" };

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    // Only the service role can set app_metadata → the DB trigger copies role_tags from here.
    app_metadata: { role_tags: invite.role_tags },
    user_metadata: { full_name: fullName },
  });

  if (createErr || !created.user) {
    // Give the token back so the invitee can retry (or an admin can revoke).
    await admin.from("staff_invites").update({ status: "pending" }).eq("id", invite.id);
    const msg = (createErr?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return { error: `An account for ${invite.email} already exists. Sign in instead, or ask an admin.` };
    }
    console.error("[acceptStaffInvite] createUser failed:", createErr);
    return { error: "Could not create your account. Please try again or contact an admin." };
  }

  // Belt and braces: the DB trigger mirrors app_metadata.role_tags into the
  // profile; verify it did, and correct (with the service role) if not, so an
  // invited staffer can never end up tagged as a landlord.
  const { data: profile } = await admin.from("profiles").select("role_tags").eq("id", created.user.id).maybeSingle();
  const expected = [...invite.role_tags].sort().join(",");
  if (!profile || [...profile.role_tags].sort().join(",") !== expected) {
    console.warn(`[acceptStaffInvite] profile role_tags ${JSON.stringify(profile?.role_tags)} ≠ invite ${expected}; correcting.`);
    await admin.from("profiles").update({ role_tags: invite.role_tags }).eq("id", created.user.id);
  }

  await notifyByEmail({
    to: invite.email,
    event: "staff_account_ready",
    subject: "Your HomeLy staff account is ready",
    message: `Welcome, ${fullName}. Your account (${invite.role_tags.join(" + ")}) is active. Sign in at /login with the password you just set.`,
    context: `invite ${invite.id} → user ${created.user.id}`,
  });

  // Sign them in with the password they just chose (sets the session cookies).
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: invite.email, password });
  if (signInErr) {
    redirect(`/login?msg=${encodeURIComponent("Your staff account is ready. Sign in with your new password.")}`);
  }
  redirect("/admin/waitlist");
}
