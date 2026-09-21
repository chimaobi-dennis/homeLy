"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdminAction } from "@/lib/auth";
import { conversionInvitePath, INVITE_EXPIRY_DAYS } from "@/lib/invites";
import { notifyByEmail } from "@/lib/notifications";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";

/**
 * Queue-conversion invites (Stage 2). Same pattern as /admin/staff/actions.ts:
 * the caller's admin role is re-read from the DB every call; invite rows are
 * written through the admin's OWN session (RLS: admin insert/update); the
 * service role is used only for waitlist_entries.conversion_status, which no
 * client session may update. Redirects back with ?msg= / ?error= / ?created=.
 */

function back(params: { msg?: string; error?: string; created?: string[] }): never {
  const q = new URLSearchParams();
  if (params.created?.length) q.set("created", params.created.join(","));
  if (params.msg) q.set("msg", params.msg);
  if (params.error) q.set("error", params.error);
  redirect(`/admin/waitlist${q.size ? `?${q.toString()}` : ""}`);
}

function expiresAt(): string {
  // ASSUMPTION: 7-day expiry, same as staff invites (INVITE_EXPIRY_DAYS).
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function notifyInvite(entry: { id: string; email: string; name: string }, token: string) {
  const url = `${await getSiteUrl()}${conversionInvitePath(token)}`;
  await notifyByEmail({
    to: entry.email,
    event: "tenant_conversion_invite",
    subject: "Your place on the HomeLy priority list: next step",
    message:
      `Hello ${entry.name},\n\nThe official queue is opening. To keep your place, create your HomeLy account and ` +
      `confirm your identity here (link valid for ${INVITE_EXPIRY_DAYS} days, single use):\n${url}`,
    context: `waitlist entry ${entry.id}`,
  });
}

// ---------------------------------------------------------------------------
// Invite one entry
// ---------------------------------------------------------------------------
export async function inviteToConvert(formData: FormData): Promise<void> {
  let created: string | null = null;
  let error: string | null = null;
  try {
    const admin = await assertAdminAction();
    const entryId = String(formData.get("entryId") ?? "");
    if (!isUuid(entryId)) throw new Error("Invalid waitlist entry.");

    const supabase = await createClient();
    const { data: entry } = await supabase.from("waitlist_entries").select("id, name, email").eq("id", entryId).maybeSingle();
    if (!entry) throw new Error("Waitlist entry not found.");
    const { data: existingTenant } = await supabase.from("tenants").select("id").eq("waitlist_entry_id", entryId).maybeSingle();
    if (existingTenant) throw new Error(`${entry.email} has already converted to a tenant account.`);

    const { data: invite, error: insErr } = await supabase
      .from("queue_conversion_invites")
      .insert({ waitlist_entry_id: entryId, invited_by: admin.id, expires_at: expiresAt() })
      .select("id, token")
      .single();
    if (insErr) {
      if (insErr.code === "23505") throw new Error(`${entry.email} already has a pending invite. Revoke it first if you need a new link.`);
      throw new Error(insErr.message);
    }

    const service = createAdminClient();
    await service.from("waitlist_entries").update({ conversion_status: "invited_to_convert" }).eq("id", entryId).eq("conversion_status", "waitlist");

    await notifyInvite(entry, invite.token);
    revalidatePath("/admin/waitlist");
    created = invite.id;
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(error ? { error } : { created: created ? [created] : [], msg: "Invite created. Copy the link and send it yourself — email sending is stubbed." });
}

// ---------------------------------------------------------------------------
// Invite everyone still waiting (for when the queue actually opens)
// ---------------------------------------------------------------------------
export async function inviteAllToConvert(): Promise<void> {
  let created: string[] = [];
  let error: string | null = null;
  let skipped = 0;
  try {
    const admin = await assertAdminAction();
    const supabase = await createClient();

    // Expired-but-still-pending invites are recorded as expired first, so the
    // one-pending-per-entry index does not block a fresh invite.
    await supabase.from("queue_conversion_invites").update({ status: "expired" }).eq("status", "pending").lt("expires_at", new Date().toISOString());

    const [{ data: entries }, { data: pending }, { data: tenants }] = await Promise.all([
      supabase
        .from("waitlist_entries")
        .select("id, name, email")
        .in("conversion_status", ["waitlist", "invited_to_convert"])
        .order("joined_at", { ascending: true }),
      supabase.from("queue_conversion_invites").select("waitlist_entry_id").eq("status", "pending"),
      supabase.from("tenants").select("waitlist_entry_id"),
    ]);
    const blocked = new Set([
      ...(pending ?? []).map((p) => p.waitlist_entry_id),
      ...(tenants ?? []).map((t) => t.waitlist_entry_id).filter((id): id is string => Boolean(id)),
    ]);
    const targets = (entries ?? []).filter((e) => !blocked.has(e.id));
    skipped = (entries ?? []).length - targets.length;
    if (targets.length === 0) throw new Error("Nobody is waiting without an invite.");

    const { data: invites, error: insErr } = await supabase
      .from("queue_conversion_invites")
      .insert(targets.map((e) => ({ waitlist_entry_id: e.id, invited_by: admin.id, expires_at: expiresAt() })))
      .select("id, token, waitlist_entry_id");
    if (insErr) throw new Error(insErr.message);

    const service = createAdminClient();
    await service
      .from("waitlist_entries")
      .update({ conversion_status: "invited_to_convert" })
      .in("id", targets.map((e) => e.id))
      .in("conversion_status", ["waitlist", "invited_to_convert"]);

    const byEntry = new Map(targets.map((e) => [e.id, e]));
    for (const inv of invites ?? []) {
      const entry = byEntry.get(inv.waitlist_entry_id);
      if (entry) await notifyInvite(entry, inv.token);
    }
    revalidatePath("/admin/waitlist");
    created = (invites ?? []).map((i) => i.id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(
    error
      ? { error }
      : { created, msg: `${created.length} invite(s) created${skipped ? `, ${skipped} skipped (already invited or converted)` : ""}. Links are listed below — email sending is stubbed.` },
  );
}

// ---------------------------------------------------------------------------
// Revoke a pending invite
// ---------------------------------------------------------------------------
export async function revokeConversionInvite(formData: FormData): Promise<void> {
  let error: string | null = null;
  try {
    await assertAdminAction();
    const id = String(formData.get("inviteId") ?? "");
    if (!isUuid(id)) throw new Error("Invalid invite.");

    const supabase = await createClient();
    const { data, error: dbErr } = await supabase
      .from("queue_conversion_invites")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("status", "pending")
      .select("id, waitlist_entry_id")
      .maybeSingle();
    if (dbErr) throw new Error(dbErr.message);
    if (!data) throw new Error("Invite is not pending, so there is nothing to revoke.");

    // Not converted yet → back to plain 'waitlist' so they can be re-invited later.
    const service = createAdminClient();
    const { data: tenant } = await service.from("tenants").select("id").eq("waitlist_entry_id", data.waitlist_entry_id).maybeSingle();
    if (!tenant) {
      await service.from("waitlist_entries").update({ conversion_status: "waitlist" }).eq("id", data.waitlist_entry_id).eq("conversion_status", "invited_to_convert");
    }
    revalidatePath("/admin/waitlist");
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(error ? { error } : { msg: "Invite revoked. The link no longer works." });
}
