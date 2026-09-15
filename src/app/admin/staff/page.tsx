import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { INVITE_EXPIRY_DAYS, INVITE_STATE_LABEL, invitePath, inviteState, type InviteState } from "@/lib/invites";
import { isAdmin, STAFF_ROLE_TAGS } from "@/lib/roles";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createStaffInvite, deactivateStaff, reactivateStaff, revokeStaffInvite } from "./actions";

export const metadata: Metadata = { title: "Staff · HomeLy admin" };

const box = "rounded-md border border-zinc-300 p-4 dark:border-zinc-700";
const btn = "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900";
const btnDanger = "rounded border border-red-700 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-300";
const input = "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const STATE_CLASS: Record<InviteState, string> = {
  valid: "text-amber-800 dark:text-amber-300",
  accepted: "text-emerald-800 dark:text-emerald-300",
  revoked: "text-zinc-500",
  expired: "text-red-700 dark:text-red-300",
};

function isBanned(bannedUntil: string | null | undefined): boolean {
  return Boolean(bannedUntil) && new Date(bannedUntil as string).getTime() > Date.now();
}

/** Internal. Function over form. Admin-only (page-level gate on top of the /admin shell). */
export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; msg?: string; error?: string }>;
}) {
  const viewer = await requireAdminPage("/admin/staff");
  const { created, msg, error } = await searchParams;

  const supabase = await createClient();
  const [{ data: invites }, { data: staffProfiles }, users, siteUrl] = await Promise.all([
    supabase.from("staff_invites").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, role_tags, created_at").overlaps("role_tags", [...STAFF_ROLE_TAGS]).order("created_at", { ascending: true }),
    // Emails + ban state live in auth.users: service role is the only reader.
    createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 }),
    getSiteUrl(),
  ]);

  const inviteRows = (invites ?? []).map((i) => ({ ...i, state: inviteState(i) }));
  const userById = new Map((users.data?.users ?? []).map((u) => [u.id, u]));
  const inviterName = new Map<string, string>();
  for (const p of staffProfiles ?? []) inviterName.set(p.id, p.full_name ?? "");
  const justCreated = created ? inviteRows.find((i) => i.id === created) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Staff</h1>
      {msg ? <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p> : null}
      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {justCreated ? (
        <section className="rounded-md border-2 border-emerald-600 p-4">
          <h2 className="font-semibold">Invite link for {justCreated.email}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Email sending is stubbed (see the server console). Copy this link and send it yourself. It is single-use
            and expires {new Date(justCreated.expires_at).toLocaleString("en-NG")}.
          </p>
          <input
            readOnly
            value={`${siteUrl}${invitePath(justCreated.token)}`}
            className={`${input} mt-2 w-full font-mono text-xs`}
            aria-label="Invite link"
          />
        </section>
      ) : null}

      <section className={box}>
        <h2 className="font-semibold">Invite a staff member</h2>
        <p className="mt-1 text-sm text-zinc-500">
          One account can hold both tags. Links expire after {INVITE_EXPIRY_DAYS} days. The email must not already
          have a HomeLy account of any kind.
        </p>
        <form action={createStaffInvite} className="mt-3 flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span>Email</span>
            <input name="email" type="email" required className={`${input} min-w-72`} placeholder="name@example.com" />
          </label>
          <fieldset className="flex items-center gap-4">
            <legend className="sr-only">Roles</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="role_tags" value="bd" /> BD
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="role_tags" value="inspector" /> Inspector
            </label>
          </fieldset>
          <button type="submit" className={btn}>
            Create invite
          </button>
        </form>
      </section>

      <section className={box}>
        <h2 className="font-semibold">Invites ({inviteRows.length})</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Roles</th>
                <th className="py-2 pr-3">State</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Expires</th>
                <th className="py-2 pr-3">Invited by</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {inviteRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-zinc-500">
                    No invites yet.
                  </td>
                </tr>
              ) : null}
              {inviteRows.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 pr-3">{i.email}</td>
                  <td className="py-2 pr-3">{i.role_tags.join(" + ")}</td>
                  <td className={`py-2 pr-3 font-medium ${STATE_CLASS[i.state]}`}>{INVITE_STATE_LABEL[i.state]}</td>
                  <td className="py-2 pr-3">{new Date(i.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</td>
                  <td className="py-2 pr-3">{new Date(i.expires_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</td>
                  <td className="py-2 pr-3">
                    {i.invited_by === viewer.id ? "you" : (i.invited_by && inviterName.get(i.invited_by)) || (i.invited_by ? "admin" : "—")}
                  </td>
                  <td className="py-2">
                    {i.state === "valid" ? (
                      <form action={revokeStaffInvite}>
                        <input type="hidden" name="inviteId" value={i.id} />
                        <button type="submit" className={btnDanger}>
                          Revoke
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={box}>
        <h2 className="font-semibold">Staff accounts ({(staffProfiles ?? []).length})</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Deactivate = banned at the Supabase Auth layer. Nothing is deleted; profile and history stay for audit. The
          account can be reactivated.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Roles</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Since</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {(staffProfiles ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-zinc-500">
                    No staff accounts yet.
                  </td>
                </tr>
              ) : null}
              {(staffProfiles ?? []).map((p) => {
                const u = userById.get(p.id);
                const banned = isBanned(u?.banned_until);
                const admin = isAdmin(p.role_tags);
                return (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 font-medium">{p.full_name ?? "—"}</td>
                    <td className="py-2 pr-3">{u?.email ?? "—"}</td>
                    <td className="py-2 pr-3">{p.role_tags.join(" + ")}</td>
                    <td className="py-2 pr-3">
                      {banned ? (
                        <span className="text-red-700 dark:text-red-300">Deactivated</span>
                      ) : (
                        <span className="text-emerald-800 dark:text-emerald-300">Active</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{new Date(p.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</td>
                    <td className="py-2">
                      {admin ? (
                        <span className="text-xs text-zinc-500">admin — not managed here</span>
                      ) : banned ? (
                        <form action={reactivateStaff}>
                          <input type="hidden" name="userId" value={p.id} />
                          <button type="submit" className={btn}>
                            Reactivate
                          </button>
                        </form>
                      ) : (
                        <form action={deactivateStaff}>
                          <input type="hidden" name="userId" value={p.id} />
                          <button type="submit" className={btnDanger}>
                            Deactivate
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
