"use server";

import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { inviteState, isInviteToken, type InviteState } from "@/lib/invites";
import { notifyTenant } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requiredText } from "@/lib/validation";

export type ConvertState = {
  error: string | null;
  inviteState?: Exclude<InviteState, "valid">;
};

const STATE_MESSAGE: Record<Exclude<InviteState, "valid">, string> = {
  accepted: "This invite has already been used.",
  revoked: "This invite was withdrawn by HomeLy.",
  expired: "This invite has expired.",
};

type Loaded = {
  invite: { id: string; waitlist_entry_id: string; status: "pending" | "accepted" | "revoked" | "expired"; expires_at: string };
  entry: { id: string; name: string; email: string; whatsapp_number: string };
};

async function loadInvite(token: string): Promise<Loaded | null> {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("queue_conversion_invites")
    .select("id, waitlist_entry_id, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite) return null;
  const { data: entry } = await admin
    .from("waitlist_entries")
    .select("id, name, email, whatsapp_number")
    .eq("id", invite.waitlist_entry_id)
    .maybeSingle();
  if (!entry) return null;
  return { invite, entry };
}

/** Claim the token atomically (pending → accepted, only while valid). */
async function claim(inviteId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("queue_conversion_invites")
    .update({ status: "accepted" })
    .eq("id", inviteId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

async function unclaim(inviteId: string): Promise<void> {
  await createAdminClient().from("queue_conversion_invites").update({ status: "pending" }).eq("id", inviteId);
}

async function createTenantRow(userId: string, entryId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { error } = await admin.from("tenants").insert({ id: userId, waitlist_entry_id: entryId, kyc_status: "not_started" });
  return error ? error.message : null;
}

/**
 * New account path: create the auth user through the Admin API (the
 * self-service sign-up would tag them as a landlord) with
 * app_metadata.role_tags = ['tenant'], create the tenants row, sign them in.
 */
export async function acceptConversionInvite(_prev: ConvertState, formData: FormData): Promise<ConvertState> {
  const token = String(formData.get("token") ?? "");
  const fullName = requiredText(formData.get("fullName"), "Your name", 120);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!isInviteToken(token)) return { error: "This invite link is not valid." };
  if (typeof fullName !== "string") return { error: fullName.error };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const loaded = await loadInvite(token);
  if (!loaded) return { error: "This invite link is not valid." };
  const { invite, entry } = loaded;
  const state = inviteState(invite);
  if (state !== "valid") return { error: STATE_MESSAGE[state], inviteState: state };

  const admin = createAdminClient();
  const { data: registered } = await admin.rpc("email_is_registered", { p_email: entry.email });
  if (registered) {
    return {
      error: `${entry.email} already has a HomeLy account. Sign in with it, then open this link again to continue as that account.`,
    };
  }

  if (!(await claim(invite.id))) {
    return { error: "This invite was just used or has expired. Contact HomeLy for a new link.", inviteState: "expired" };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: entry.email,
    password,
    email_confirm: true,
    app_metadata: { role_tags: ["tenant"] },
    user_metadata: { full_name: fullName, phone: entry.whatsapp_number },
  });
  if (createErr || !created.user) {
    await unclaim(invite.id);
    console.error("[acceptConversionInvite] createUser failed:", createErr);
    return { error: "Could not create your account. Please try again or contact HomeLy." };
  }

  // Belt and braces (see staff invites): make sure the profile carries the tenant tag.
  const { data: profile } = await admin.from("profiles").select("role_tags").eq("id", created.user.id).maybeSingle();
  if (!profile || !profile.role_tags.includes("tenant")) {
    console.warn(`[acceptConversionInvite] profile role_tags ${JSON.stringify(profile?.role_tags)} missing tenant; correcting.`);
    await admin.from("profiles").update({ role_tags: ["tenant"] }).eq("id", created.user.id);
  }

  const rowErr = await createTenantRow(created.user.id, entry.id);
  if (rowErr) {
    console.error("[acceptConversionInvite] tenants insert failed:", rowErr);
    return { error: "Your account was created but could not be linked to the queue. Contact HomeLy." };
  }

  await notifyTenant({
    tenantId: created.user.id,
    event: "tenant_account_ready",
    subject: "Your HomeLy account is ready — one more step",
    message: `Welcome, ${fullName}. Your account is ready. Upload a government-issued ID on your status page so we can confirm who you are and keep your place in the queue.`,
  });

  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: entry.email, password });
  if (signInErr) redirect(`/login?msg=${encodeURIComponent("Your account is ready. Sign in with your new password.")}`);
  redirect("/tenant?welcome=1");
}

/**
 * Existing account path: the waitlist email already belongs to a signed-in
 * user (for example a landlord who also joined the list). Add the tenant tag
 * and the tenants row to THAT account instead of creating a second one.
 */
export async function attachConversionInviteToSession(_prev: ConvertState, formData: FormData): Promise<ConvertState> {
  const token = String(formData.get("token") ?? "");
  if (!isInviteToken(token)) return { error: "This invite link is not valid." };

  const session = await getSessionProfile();
  if (!session) return { error: "Sign in first, then open this link again." };

  const loaded = await loadInvite(token);
  if (!loaded) return { error: "This invite link is not valid." };
  const { invite, entry } = loaded;
  const state = inviteState(invite);
  if (state !== "valid") return { error: STATE_MESSAGE[state], inviteState: state };
  if ((session.email ?? "").toLowerCase() !== entry.email.toLowerCase()) {
    return { error: `This invite is for ${entry.email}, but you are signed in as ${session.email}. Sign out and use the right account.` };
  }

  if (!(await claim(invite.id))) {
    return { error: "This invite was just used or has expired. Contact HomeLy for a new link.", inviteState: "expired" };
  }

  const admin = createAdminClient();
  if (!session.roleTags.includes("tenant")) {
    const { error: tagErr } = await admin
      .from("profiles")
      .update({ role_tags: [...session.roleTags, "tenant"] })
      .eq("id", session.id);
    if (tagErr) {
      await unclaim(invite.id);
      return { error: `Could not add the tenant role: ${tagErr.message}` };
    }
  }
  const rowErr = await createTenantRow(session.id, entry.id);
  if (rowErr && !rowErr.includes("duplicate")) {
    await unclaim(invite.id);
    return { error: `Could not link your account to the queue: ${rowErr}` };
  }

  await notifyTenant({
    tenantId: session.id,
    event: "tenant_account_ready",
    subject: "Your HomeLy account is now on the queue — one more step",
    message: "Upload a government-issued ID on your status page so we can confirm who you are and keep your place in the queue.",
  });
  redirect("/tenant?welcome=1");
}
