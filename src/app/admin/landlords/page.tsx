import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { AGREEMENT_STATUS, LANDLORD_STATUS, type LandlordStatus } from "@/lib/status-labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Landlords · HomeLy admin" };

const STATUSES: LandlordStatus[] = ["applied", "kyc_pending", "kyc_verified", "kyc_rejected"];

/** Internal list. Function over form. Reads go through the admin's own session (RLS: admin selects all). */
export default async function AdminLandlordsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status: filter, error } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("landlords")
    .select("id, status, agreement_status, country_of_residence, created_at")
    .order("created_at", { ascending: false });
  if (filter && (STATUSES as string[]).includes(filter)) query = query.eq("status", filter as LandlordStatus);
  const { data: landlords } = await query;
  const rows = landlords ?? [];
  const ids = rows.map((l) => l.id);

  const [{ data: profiles }, { data: docs }, { data: props }, users] = await Promise.all([
    ids.length ? supabase.from("profiles").select("id, full_name, phone").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("landlord_documents").select("landlord_id, document_type").in("landlord_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("properties").select("landlord_id, status").in("landlord_id", ids) : Promise.resolve({ data: [] }),
    // Emails live in auth.users; only the service role can list them.
    createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const emailById = new Map((users.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const docTypesById = new Map<string, Set<string>>();
  for (const d of docs ?? []) {
    if (!docTypesById.has(d.landlord_id)) docTypesById.set(d.landlord_id, new Set());
    docTypesById.get(d.landlord_id)!.add(d.document_type);
  }
  const propCountById = new Map<string, number>();
  for (const p of props ?? []) propCountById.set(p.landlord_id, (propCountById.get(p.landlord_id) ?? 0) + 1);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-8">
      <h1 className="text-2xl font-semibold">Landlord applications</h1>
      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/landlords" className={!filter ? "font-semibold underline" : "underline"}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/landlords?status=${s}`} className={filter === s ? "font-semibold underline" : "underline"}>
            {LANDLORD_STATUS[s].label}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
              <th className="py-2 pr-3">Landlord</th>
              <th className="py-2 pr-3">Country</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Agreement</th>
              <th className="py-2 pr-3">Docs</th>
              <th className="py-2 pr-3">Properties</th>
              <th className="py-2 pr-3">Applied</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-zinc-500">
                  No applications{filter ? ` with status ${filter}` : ""}.
                </td>
              </tr>
            ) : null}
            {rows.map((l) => {
              const p = profileById.get(l.id);
              const docCount = docTypesById.get(l.id)?.size ?? 0;
              return (
                <tr key={l.id}>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{p?.full_name ?? "—"}</div>
                    <div className="text-zinc-500">{emailById.get(l.id) || "—"}</div>
                    <div className="text-zinc-500">{p?.phone ?? ""}</div>
                  </td>
                  <td className="py-2 pr-3">{l.country_of_residence ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge label={LANDLORD_STATUS[l.status].label} tone={LANDLORD_STATUS[l.status].tone} />
                  </td>
                  <td className="py-2 pr-3">{AGREEMENT_STATUS[l.agreement_status].label}</td>
                  <td className="py-2 pr-3">{docCount}/2</td>
                  <td className="py-2 pr-3">{propCountById.get(l.id) ?? 0}</td>
                  <td className="py-2 pr-3">{new Date(l.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</td>
                  <td className="py-2">
                    <Link href={`/admin/landlords/${l.id}`} className="underline">
                      Review
                    </Link>
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
