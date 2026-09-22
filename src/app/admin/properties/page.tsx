import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { requireStaffOrAdminPage } from "@/lib/auth";
import { formatNgn } from "@/lib/fees";
import { PROPERTY_STATUS, type PropertyStatus } from "@/lib/status-labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Properties · HomeLy admin" };

const STATUSES: PropertyStatus[] = ["submitted", "under_inspection", "listed", "rejected"];

/** Listings overview for staff and admin. Reads through the viewer's session (staff select all properties + landlord profiles). */
export default async function AdminPropertiesPage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  await requireStaffOrAdminPage("/admin/properties");
  const { status: rawStatus, error } = await searchParams;
  const filter: PropertyStatus | "all" = (STATUSES as string[]).includes(rawStatus ?? "") ? (rawStatus as PropertyStatus) : "all";

  const supabase = await createClient();
  let query = supabase
    .from("properties")
    .select("id, address, city, bedrooms, target_annual_rent, status, listed_at, listing_headline, landlord_id, updated_at")
    .order("updated_at", { ascending: false });
  if (filter !== "all") query = query.eq("status", filter);
  const { data: properties } = await query;
  const rows = properties ?? [];
  const landlordIds = [...new Set(rows.map((r) => r.landlord_id))];
  const ids = rows.map((r) => r.id);

  const [{ data: profiles }, { data: photos }] = await Promise.all([
    landlordIds.length ? supabase.from("profiles").select("id, full_name").in("id", landlordIds) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("property_photos").select("property_id").in("property_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "(no name)"]));
  const photoCount = new Map<string, number>();
  for (const p of photos ?? []) photoCount.set(p.property_id, (photoCount.get(p.property_id) ?? 0) + 1);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Properties</h1>
        <p className="text-sm text-zinc-500">Listing content and photos are written by HomeLy staff. Only an admin publishes.</p>
      </div>
      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/properties" className={filter === "all" ? "font-semibold underline" : "underline"}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/properties?status=${s}`} className={filter === s ? "font-semibold underline" : "underline"}>
            {PROPERTY_STATUS[s].label}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left dark:border-zinc-700">
              <th className="py-2 pr-3">Property</th>
              <th className="py-2 pr-3">City</th>
              <th className="py-2 pr-3">Landlord</th>
              <th className="py-2 pr-3">Rent / yr</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Photos</th>
              <th className="py-2 pr-3">Listed</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-zinc-500">
                  No properties{filter !== "all" ? ` with status ${filter}` : ""}.
                </td>
              </tr>
            ) : null}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="py-2 pr-3">
                  <div className="font-medium">{p.listing_headline ?? p.address}</div>
                  <div className="text-zinc-500">
                    {p.address} · {p.bedrooms} bed
                  </div>
                </td>
                <td className="py-2 pr-3">{p.city}</td>
                <td className="py-2 pr-3">{nameById.get(p.landlord_id) ?? "—"}</td>
                <td className="py-2 pr-3">{formatNgn(p.target_annual_rent)}</td>
                <td className="py-2 pr-3">
                  <StatusBadge label={PROPERTY_STATUS[p.status].label} tone={PROPERTY_STATUS[p.status].tone} />
                </td>
                <td className="py-2 pr-3">{photoCount.get(p.id) ?? 0}</td>
                <td className="py-2 pr-3">{p.listed_at ? new Date(p.listed_at).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "—"}</td>
                <td className="py-2">
                  <Link href={`/admin/properties/${p.id}`} className="underline">
                    Edit listing
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
