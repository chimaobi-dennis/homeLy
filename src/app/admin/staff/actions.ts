"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdminAction } from "@/lib/auth";
import { INVITE_EXPIRY_DAYS, invitePath } from "@/lib/invites";
import { notifyByEmail } from "@/lib/notifications";
import { isAdmin, STAFF_ROLE_TAGS, type StaffRoleTag } from "@/lib/roles";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isEmail, isUuid } from "@/lib/validation";

/**
 * Same pattern as /admin/landlords/actions.ts: every action re-reads the
 * caller's role_tags from the DB via their own session (assertAdminAction),
 * uses the admin's OWN session for staff_invites reads/writes (RLS: admin
 * select / insert / update), and reaches for the service role only where the
 * Auth Admin API is the only way (email check, ban / unban). Redirects back
 * with ?msg= / ?error= (+ ?created= to show a fresh invite URL).
 */

function back(params: { msg?: string; error?: string; created?: string }): never {
  const q = new URLSearchParams();
  if (params.created) q.set("created", params.created);
  if (params.msg) q.set("msg", params.msg);
  if (params.error) q.set("error", params.error);
  redirect(`/admin/staff${q.size ? `?${q.toString()}` : ""}`);
}

// ---------------------------------------------------------------------------
// Create an invite
// ---------------------------------------------------------------------------
export async function createStaffInvite(formData: FormData): Promise<void> {
  let created: string | null = null;
  let error: string | null = null;

  try {
    const admin = await assertAdminAction();

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!isEmail(email)) throw new Error("Enter a valid email address.");

    const roleTags = formData
      .getAll("role_tags")
      .map(String)
      .filter((t): t is StaffRoleTag => (STAFF_ROLE_TAGS as readonly string[]).includes(t));
    if (roleTags.length === 0) throw new Error("Tick at least one role: BD and/or Inspector.");

    // Up-front: the email must not already belong to ANY auth user (staff, landlord, admin).
    const service = createAdminClient();
    const { data: registered, error: rpcErr } = await service.rpc("email_is_registered", { p_email: email });
    if (rpcErr) throw new Error(`Could not check existing accounts: ${rpcErr.message}`);
    if (registered) {
      throw new Error(`${email} already has a HomeLy account. Invites are only for new staff; manage existing accounts below.`);
    }

    // ASSUMPTION: 7-day expiry (see INVITE_EXPIRY_DAYS). Token comes from the DB default.
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const supabase = await createClient(); // admin's own session → RLS "staff_invites: admin inserts"
    const { data: invite, error: insErr } = await supabase
      .from("staff_invites")
      .insert({ email, role_tags: roleTags, invited_by: admin.id, expires_at: expiresAt })
      .select("id, token")
      .single();
    if (insErr) {
      if (insErr.code === "23505") throw new Error(`${email} already has a pending invite. Revoke it first if you need a new link.`);
      throw new Error(insErr.message);
    }

    const url = `${await getSiteUrl()}${invitePath(invite.token)}`;
    await notifyByEmail({
      to: email,
      event: "staff_invite",
      subject: "You're invited to join HomeLy staff",
      message:
        `You have been invited to HomeLy as ${roleTags.join(" + ")}.\n\n` +
        `Set your password here (link valid for ${INVITE_EXPIRY_DAYS} days, single use):\n${url}`,
      context: `invite ${invite.id}`,
    });

    revalidatePath("/admin/staff");
    created = invite.id;
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }

  back(error ? { error } : { created: created ?? undefined, msg: "Invite created. Copy the link below and send it yourself — email sending is stubbed." });
}

// ---------------------------------------------------------------------------
// Revoke a pending invite (the token stops working immediately)
// ---------------------------------------------------------------------------
export async function revokeStaffInvite(formData: FormData): Promise<void> {
  let error: string | null = null;
  try {
    await assertAdminAction();
    const id = String(formData.get("inviteId") ?? "");
    if (!isUuid(id)) throw new Error("Invalid invite.");

    const supabase = await createClient();
    const { data, error: dbErr } = await supabase
      .from("staff_invites")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (dbErr) throw new Error(dbErr.message);
    if (!data) throw new Error("Invite is not pending, so there is nothing to revoke.");
    revalidatePath("/admin/staff");
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(error ? { error } : { msg: "Invite revoked. The link no longer works." });
}

// ---------------------------------------------------------------------------
// Deactivate / reactivate a staff account = ban / unban at the AUTH layer.
// Nothing is deleted: profile, assignments and history stay for audit.
// ---------------------------------------------------------------------------
const BAN_FOREVER = "876000h"; // ~100 years; Supabase expects a Go duration string

async function setStaffBan(formData: FormData, ban: boolean): Promise<void> {
  let error: string | null = null;
  let msg: string | null = null;
  try {
    const admin = await assertAdminAction();
    const userId = String(formData.get("userId") ?? "");
    if (!isUuid(userId)) throw new Error("Invalid user.");
    if (userId === admin.id) throw new Error("You cannot deactivate your own account.");

    const supabase = await createClient(); // admin session: "profiles: admin selects all rows"
    const { data: target } = await supabase.from("profiles").select("full_name, role_tags").eq("id", userId).maybeSingle();
    if (!target) throw new Error("No profile found for that user.");
    if (isAdmin(target.role_tags)) throw new Error("Admin accounts cannot be deactivated from this screen.");
    if (!target.role_tags.some((t) => (STAFF_ROLE_TAGS as readonly string[]).includes(t))) {
      throw new Error("Only staff (BD / Inspector) accounts can be managed here.");
    }

    const service = createAdminClient();
    const { error: banErr } = await service.auth.admin.updateUserById(userId, {
      ban_duration: ban ? BAN_FOREVER : "none",
    });
    if (banErr) throw new Error(`Auth update failed: ${banErr.message}`);

    revalidatePath("/admin/staff");
    msg = ban
      ? `${target.full_name ?? "Account"} deactivated (banned at the auth layer). Their history is kept.`
      : `${target.full_name ?? "Account"} reactivated.`;
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(error ? { error } : { msg: msg ?? undefined });
}

export async function deactivateStaff(formData: FormData): Promise<void> {
  return setStaffBan(formData, true);
}

export async function reactivateStaff(formData: FormData): Promise<void> {
  return setStaffBan(formData, false);
}
