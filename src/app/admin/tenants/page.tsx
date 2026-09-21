import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { requireAdminPage } from "@/lib/auth";
import { TENANT_ID_DOCUMENT_LABEL, TENANT_KYC_STATUS, type TenantKycStatus } from "@/lib/status-labels";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { setTenantKyc } from "./actions";

export const metadata: Metadata = { title: "Tenants · HomeLy admin" };

const STATUSES: TenantKycStatus[] = ["pending", "not_started", "rejected", "verified"];
const box = "rounded-md border border-zinc-300 p-4 dark:border-zinc-700";
const btn = "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900";
const input = "w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const DAY_MS = 24 * 60 * 60 * 1000;
type TenantDocRow = Database["public"]["Tables"]["tenant_documents"]["Row"];

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));
}

/**
 * Tenant KYC review (Stage 2). Admin-only, same bar as /admin/landlords.
 * Reads go through the admin's own session; the document link is a signed URL
 * created with the admin's session (staff/admin read policy on the bucket).
 */
export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string; error?: string }>;
}) {
  await requireAdminPage("/admin/tenants");
  const { status: rawStatus, msg, error } = await searchParams;
  const filter: TenantKycStatus | "all" = (STATUSES as string[]).includes(rawStatus ?? "") ? (rawStatus as TenantKycStatus) : rawStatus === "all" ? "all" : "pending";
  const returnTo = `/admin/tenants?status=${filter}`;

  const supabase = await createClient();
  let query = supabase.from("tenants").select("*").order("updated_at", { ascending: false });
  if (filter !== "all") query = query.eq("kyc_status", filter);
  const { data: tenants } = await query;
  const rows = tenants ?? [];
  const ids = rows.map((t) => t.id);
  const entryIds = rows.map((t) => t.waitlist_entry_id).filter((id): id is string => Boolean(id));

  const [{ data: profiles }, { data: docs }, { data: entries }, users] = await Promise.all([
    ids.length ? supabase.from("profiles").select("id, full_name, phone, role_tags").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("tenant_documents").select("*").in("tenant_id", ids).order("uploaded_at", { ascending: false }) : Promise.resolve({ data: [] }),
    entryIds.length ? supabase.from("waitlist_entries").select("id, joined_at, conversion_status").in("id", entryIds) : Promise.resolve({ data: [] }),
    createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const emailById = new Map((users.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const entryById = new Map((entries ?? []).map((e) => [e.id, e]));
  const allDocs = (docs ?? []) as TenantDocRow[];
  const docsByTenant = new Map<string, TenantDocRow[]>();
  for (const d of allDocs) {
    if (!docsByTenant.has(d.tenant_id)) docsByTenant.set(d.tenant_id, []);
    docsByTenant.get(d.tenant_id)!.push(d);
  }

  const signed = new Map<string, string>();
  await Promise.all(
    allDocs.map(async (d) => {
      const { data } = await supabase.storage.from("tenant-documents").createSignedUrl(d.storage_path, 600);
      if (data?.signedUrl) signed.set(d.id, data.signedUrl);
    }),
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Tenant KYC review</h1>
        <p className="text-sm text-zinc-500">
          Manual review only (Dojah not integrated). Verified = active queue member. Rejection reasons are shown to the tenant verbatim.
        </p>
      </div>
      {msg ? <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p> : null}
      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <nav className="flex flex-wrap gap-3 text-sm">
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/tenants?status=${s}`} className={filter === s ? "font-semibold underline" : "underline"}>
            {TENANT_KYC_STATUS[s].label}
          </Link>
        ))}
        <Link href="/admin/tenants?status=all" className={filter === "all" ? "font-semibold underline" : "underline"}>
          All
        </Link>
        <span className="text-zinc-400">·</span>
        <Link href="/admin/waitlist" className="underline">
          Back to waitlist
        </Link>
      </nav>

      {rows.length === 0 ? <p className="py-6 text-center text-sm text-zinc-500">No tenants with this status.</p> : null}

      {rows.map((t) => {
        const p = profileById.get(t.id);
        const entry = t.waitlist_entry_id ? entryById.get(t.waitlist_entry_id) : null;
        const tdocs = docsByTenant.get(t.id) ?? [];
        const st = TENANT_KYC_STATUS[t.kyc_status];
        return (
          <section key={t.id} className={box}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{p?.full_name ?? "(no name)"}</h2>
                <div className="text-sm text-zinc-500">
                  {emailById.get(t.id) || "—"} · {p?.phone ?? "no phone"} · roles {p?.role_tags.join(", ")}
                </div>
                <div className="text-sm text-zinc-500">
                  {entry
                    ? `On the list since ${new Date(entry.joined_at).toLocaleDateString("en-NG", { dateStyle: "medium" })} (${daysSince(entry.joined_at)} days) · stage ${entry.conversion_status}`
                    : "Not from the waitlist"}{" "}
                  · converted {new Date(t.converted_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}
                </div>
              </div>
              <StatusBadge label={st.label} tone={st.tone} />
            </div>
            {t.kyc_rejection_reason ? <p className="mt-2 text-sm text-red-700">Rejection reason: {t.kyc_rejection_reason}</p> : null}

            <div className="mt-3 text-sm">
              <div className="font-medium">
                {TENANT_ID_DOCUMENT_LABEL} ({tdocs.length})
              </div>
              {tdocs.length === 0 ? <p className="text-zinc-500">Nothing uploaded yet.</p> : null}
              <ul className="mt-1 space-y-1">
                {tdocs.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {d.original_filename} · {d.mime_type} · {(d.size_bytes / 1024).toFixed(0)} KB · {new Date(d.uploaded_at).toLocaleString("en-NG")}
                    </span>
                    {signed.get(d.id) ? (
                      <a href={signed.get(d.id)} target="_blank" rel="noreferrer" className="underline">
                        Open (signed URL, 10 min)
                      </a>
                    ) : (
                      <span className="text-red-700">could not sign URL</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <form action={setTenantKyc} className="mt-3 flex flex-col gap-2 text-sm">
              <input type="hidden" name="tenantId" value={t.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="flex items-center gap-2">
                <input type="radio" name="decision" value="verified" required /> Verified — ID checks out (becomes an active queue member)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="decision" value="rejected" /> Rejected — tenant will see the reason below
              </label>
              <label className="flex flex-col gap-1">
                <span>Reason (required for rejection)</span>
                <textarea name="reason" rows={2} className={input} />
              </label>
              <button type="submit" className={`${btn} self-start`}>
                Save decision
              </button>
            </form>
          </section>
        );
      })}
    </main>
  );
}
