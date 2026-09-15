import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Waitlist · HomeLy admin" };

type Conversion = Database["public"]["Enums"]["waitlist_conversion_status"];
const STAGE_LABEL: Record<Conversion, string> = {
  waitlist: "Waitlist (Stage 1)",
  invited_to_convert: "Invited to convert",
  kyc_pending: "KYC pending",
  active_queue: "Active queue",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since the join time. Computed at render, never stored. */
function daysOnList(joinedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(joinedAt).getTime()) / DAY_MS));
}

/**
 * Read-only Stage 1 view for admin + staff (bd / inspector). The /admin layout
 * gates the shell; reads go through the viewer's own session (RLS: staff and
 * admin select). No actions here on purpose — Stage 2 conversion is a later step.
 */
export default async function AdminWaitlistPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("waitlist_entries")
    .select("id, name, whatsapp_number, email, joined_at, conversion_status, email_confirmed, whatsapp_confirmed")
    .order("joined_at", { ascending: false });
  const entries = rows ?? [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Tenant waitlist</h1>
        <p className="text-sm text-zinc-500">
          {entries.length} {entries.length === 1 ? "person" : "people"} on the priority list. Read-only — no status
          changes here until Stage 2 conversion is built. Days on list is computed from the join time.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">WhatsApp</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Joined</th>
              <th className="py-2 pr-3">Days on list</th>
              <th className="py-2 pr-3">Stage</th>
              <th className="py-2">Confirmed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-zinc-500">
                  Nobody has joined yet.
                </td>
              </tr>
            ) : null}
            {entries.map((e) => {
              const days = daysOnList(e.joined_at);
              return (
                <tr key={e.id}>
                  <td className="py-2 pr-3 font-medium">{e.name}</td>
                  <td className="py-2 pr-3">{e.whatsapp_number}</td>
                  <td className="py-2 pr-3">{e.email}</td>
                  <td className="py-2 pr-3">{new Date(e.joined_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</td>
                  <td className="py-2 pr-3">{days}</td>
                  <td className="py-2 pr-3">{STAGE_LABEL[e.conversion_status]}</td>
                  <td className="py-2 text-zinc-500">
                    email {e.email_confirmed ? "✓" : "–"} · WhatsApp {e.whatsapp_confirmed ? "✓" : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
