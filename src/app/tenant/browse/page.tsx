import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { formatNgn } from "@/lib/fees";
import { PHOTO_BUCKET } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { requireVerifiedTenant } from "../gate";

export const metadata: Metadata = { title: "Available homes · HomeLy" };

/**
 * Verified tenants only (gate). Reads go through the tenant's own session:
 * RLS shows LISTED properties and their photos, nothing else. Newest listed first.
 */
export default async function TenantBrowsePage() {
  const gate = await requireVerifiedTenant("/tenant/browse");
  if (!gate.ok) return gate.element;

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, address, area, city, bedrooms, bathrooms, target_annual_rent, listing_headline, furnishing, available_from, listed_at")
    .eq("status", "listed")
    .order("listed_at", { ascending: false });
  const homes = properties ?? [];
  const ids = homes.map((h) => h.id);

  const cover = new Map<string, string>();
  if (ids.length) {
    const { data: photos } = await supabase
      .from("property_photos")
      .select("property_id, storage_path, sort_order, created_at")
      .in("property_id", ids)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    const firstPath = new Map<string, string>();
    for (const p of photos ?? []) if (!firstPath.has(p.property_id)) firstPath.set(p.property_id, p.storage_path);
    if (firstPath.size) {
      const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls([...firstPath.values()], 600);
      const byPath = new Map((signed ?? []).filter((s) => s.signedUrl && s.path).map((s) => [s.path as string, s.signedUrl]));
      for (const [pid, path] of firstPath) {
        const url = byPath.get(path);
        if (url) cover.set(pid, url);
      }
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Available homes</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Inspected homes in Enugu</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Every home here has been checked by a person from our team. You are seeing this because your ID is verified.
            Applications open in a later step — for now, look and take note.
          </p>
        </div>

        {homes.length === 0 ? (
          <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">Nothing listed yet</h2>
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">
              You are verified and your place in the queue is kept. As soon as a home is listed it appears here, and we notify you by email or WhatsApp.
            </p>
          </section>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {homes.map((h) => (
              <li key={h.id} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <Link href={`/tenant/browse/${h.id}`} className="block hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  {cover.get(h.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.get(h.id)} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900">No photo</div>
                  )}
                  <div className="p-4">
                    <h2 className="font-semibold">{h.listing_headline ?? h.address}</h2>
                    <p className="text-sm text-zinc-500">
                      {h.area ? `${h.area}, ` : ""}{h.city} · {h.bedrooms} bed{h.bathrooms != null ? ` · ${h.bathrooms} bath` : ""}
                    </p>
                    <p className="mt-2 text-sm">
                      <span className="font-medium">{formatNgn(h.target_annual_rent)}</span> per year
                      {h.available_from ? <span className="text-zinc-500"> · from {new Date(h.available_from).toLocaleDateString("en-NG", { dateStyle: "medium" })}</span> : null}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-zinc-500">
          <Link href="/tenant" className="underline underline-offset-4">
            Back to my status
          </Link>
        </p>
      </main>
    </>
  );
}
