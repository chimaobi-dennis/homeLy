import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffOrAdminPage } from "@/lib/auth";
import { conversionInvitePath, INVITE_EXPIRY_DAYS, INVITE_STATE_LABEL, inviteState, type InviteState } from "@/lib/invites";
import { isAdmin } from "@/lib/roles";
import { getSiteUrl } from "@/lib/site-url";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { inviteAllToConvert, inviteToConvert, revokeConversionInvite } from "./actions";

export const metadata: Metadata = { title: "Waitlist · HomeLy admin" };

type Conversion = Database["public"]["Enums"]["waitlist_conversion_status"];
const STAGE_LABEL: Record<Conversion, string> = {
  waitlist: "Waiting (Stage 1)",
  invited_to_convert: "Invited to convert",
  kyc_pending: "KYC in progress",
  active_queue: "Active queue",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const btn = "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900";
const btnDanger = "rounded border border-red-700 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:text-red-300";
const input = "rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900";

/** Whole days since the join time. Computed at render, never stored. */
function daysOnList(joinedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(joinedAt).getTime()) / DAY_MS));
}

type InviteRow = Database["public"]["Tables"]["queue_conversion_invites"]["Row"] & { state: InviteState };

/**
 * The queue. Staff (bd / inspector) see it read-only; admins can invite entries
 * to convert (Stage 2), see/copy pending invite links, and revoke them.
 * Reads go through the viewer's own session (RLS); invites are admin-only rows.
 */
export default async function AdminWaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; msg?: string; error?: string }>;
}) {
  const viewer = await requireStaffOrAdminPage("/admin/waitlist");
  const admin = isAdmin(viewer.roleTags);
  const { created, msg, error } = await searchParams;
  const createdIds = new Set((created ?? "").split(",").filter(Boolean));

  const supabase = await createClient();
  const [{ data: rows }, { data: invites }, { data: tenants }, siteUrl] = await Promise.all([
    supabase
      .from("waitlist_entries")
      .select("id, name, whatsapp_number, email, joined_at, conversion_status, email_confirmed, whatsapp_confirmed")
      .order("joined_at", { ascending: false }),
    supabase.from("queue_conversion_invites").select("*").order("created_at", { ascending: false }), // admin sees rows; staff get none
    supabase.from("tenants").select("id, waitlist_entry_id, kyc_status"),
    getSiteUrl(),
  ]);
  const entries = rows ?? [];

  const latestInviteByEntry = new Map<string, InviteRow>();
  for (const inv of invites ?? []) {
    if (!latestInviteByEntry.has(inv.waitlist_entry_id)) latestInviteByEntry.set(inv.waitlist_entry_id, { ...inv, state: inviteState(inv) });
  }
  const tenantByEntry = new Map((tenants ?? []).filter((t) => t.waitlist_entry_id).map((t) => [t.waitlist_entry_id as string, t]));
  const justCreated = (invites ?? []).filter((i) => createdIds.has(i.id));
  const entryById = new Map(entries.map((e) => [e.id, e]));

  // Re-invitable = still Stage 1 or invited-but-lapsed, no account yet, no valid invite outstanding.
  const waitingCount = entries.filter(
    (e) =>
      (e.conversion_status === "waitlist" || e.conversion_status === "invited_to_convert") &&
      !tenantByEntry.has(e.id) &&
      latestInviteByEntry.get(e.id)?.state !== "valid",
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tenant waitlist</h1>
          <p className="text-sm text-zinc-500">
            {entries.length} {entries.length === 1 ? "person" : "people"} on the priority list. Days on list is computed from the join
            time.{admin ? " Invite entries to convert when the queue opens; review their ID on the Tenants page." : " Read-only view."}
          </p>
        </div>
        {admin ? (
          <div className="flex items-center gap-3">
            <Link href="/admin/tenants" className="text-sm underline">
              Review tenant KYC
            </Link>
            <form action={inviteAllToConvert}>
              <button type="submit" className={btn} disabled={waitingCount === 0}>
                Invite everyone still waiting ({waitingCount})
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {msg ? <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p> : null}
      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {justCreated.length ? (
        <section className="rounded-md border-2 border-emerald-600 p-4">
          <h2 className="font-semibold">
            {justCreated.length === 1 ? "Invite link" : `${justCreated.length} invite links`} — copy and send yourself
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Email sending is stubbed (see the server console). Single use, valid {INVITE_EXPIRY_DAYS} days.
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {justCreated.map((i) => (
              <li key={i.id}>
                <div className="text-zinc-600">{entryById.get(i.waitlist_entry_id)?.email ?? i.waitlist_entry_id}</div>
                <input readOnly value={`${siteUrl}${conversionInvitePath(i.token)}`} className={`${input} w-full font-mono`} aria-label={`Invite link for ${entryById.get(i.waitlist_entry_id)?.email ?? "entry"}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Contact</th>
              <th className="py-2 pr-3">Joined</th>
              <th className="py-2 pr-3">Days</th>
              <th className="py-2 pr-3">Stage</th>
              <th className="py-2 pr-3">Conversion</th>
              {admin ? <th className="py-2"></th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={admin ? 7 : 6} className="py-6 text-center text-zinc-500">
                  Nobody has joined yet.
                </td>
              </tr>
            ) : null}
            {entries.map((e) => {
              const tenant = tenantByEntry.get(e.id);
              const inv = latestInviteByEntry.get(e.id);
              return (
                <tr key={e.id} className={createdIds.has(inv?.id ?? "") ? "bg-emerald-50/60 dark:bg-emerald-900/10" : ""}>
                  <td className="py-2 pr-3 font-medium">{e.name}</td>
                  <td className="py-2 pr-3">
                    <div>{e.email}</div>
                    <div className="text-zinc-500">{e.whatsapp_number}</div>
                  </td>
                  <td className="py-2 pr-3">{new Date(e.joined_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</td>
                  <td className="py-2 pr-3">{daysOnList(e.joined_at)}</td>
                  <td className="py-2 pr-3">{STAGE_LABEL[e.conversion_status]}</td>
                  <td className="py-2 pr-3">
                    {tenant ? (
                      <span>
                        Account created · KYC <strong>{tenant.kyc_status}</strong>
                      </span>
                    ) : inv ? (
                      <div className="flex flex-col gap-1">
                        <span>
                          Invite: <strong>{INVITE_STATE_LABEL[inv.state]}</strong>
                          <span className="text-zinc-500"> · expires {new Date(inv.expires_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</span>
                        </span>
                        {inv.state === "valid" && admin ? (
                          <input readOnly value={`${siteUrl}${conversionInvitePath(inv.token)}`} className={`${input} w-72 font-mono`} aria-label={`Pending invite link for ${e.email}`} />
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-zinc-500">{admin ? "Not invited" : "—"}</span>
                    )}
                  </td>
                  {admin ? (
                    <td className="py-2">
                      {tenant ? null : inv?.state === "valid" ? (
                        <form action={revokeConversionInvite}>
                          <input type="hidden" name="inviteId" value={inv.id} />
                          <button type="submit" className={btnDanger}>
                            Revoke
                          </button>
                        </form>
                      ) : (
                        <form action={inviteToConvert}>
                          <input type="hidden" name="entryId" value={e.id} />
                          <button type="submit" className={btn}>
                            Invite to convert
                          </button>
                        </form>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
