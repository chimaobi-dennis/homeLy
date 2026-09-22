import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { FEES, formatNgn } from "@/lib/fees";
import { AMENITY_LABEL, furnishingLabel, isAmenity, PHOTO_BUCKET } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";
import { requireVerifiedTenant } from "../../gate";

export const metadata: Metadata = { title: "Home details · HomeLy" };

/** Detail for one LISTED property. RLS already hides anything else; we 404 rather than hint. */
export default async function TenantPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireVerifiedTenant(`/tenant/browse/${id}`);
  if (!gate.ok) return gate.element;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: home } = await supabase.from("properties").select("*").eq("id", id).eq("status", "listed").maybeSingle();
  if (!home) notFound();

  const { data: photos } = await supabase
    .from("property_photos")
    .select("id, storage_path, caption")
    .eq("property_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const list = photos ?? [];
  const signed = new Map<string, string>();
  if (list.length) {
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(
      list.map((p) => p.storage_path),
      600,
    );
    for (const s of data ?? []) if (s.signedUrl && s.path) signed.set(s.path, s.signedUrl);
  }

  const rent = Number(home.target_annual_rent);
  const agency = (rent * FEES.agencyPct) / 100;
  const legal = (rent * FEES.legalPct) / 100;
  const amenities = home.amenities.filter(isAmenity);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
        <Link href="/tenant/browse" className="text-sm underline underline-offset-4">
          ← All available homes
        </Link>

        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{home.listing_headline ?? home.address}</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {home.address}, {home.city}
          </p>
        </div>

        {list.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((p, i) => (
              <li key={p.id} className={i === 0 ? "sm:col-span-2" : ""}>
                {signed.get(p.storage_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signed.get(p.storage_path)} alt={p.caption ?? `Photo ${i + 1}`} className="aspect-[4/3] w-full rounded-lg object-cover" loading={i === 0 ? "eager" : "lazy"} />
                ) : null}
                {p.caption ? <p className="mt-1 text-xs text-zinc-500">{p.caption}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}

        <section className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-zinc-500">Rent</dt>
          <dd className="font-medium">{formatNgn(rent)} per year</dd>
          <dt className="text-zinc-500">Bedrooms</dt>
          <dd>{home.bedrooms}</dd>
          <dt className="text-zinc-500">Bathrooms</dt>
          <dd>{home.bathrooms ?? "Not stated"}</dd>
          <dt className="text-zinc-500">Size</dt>
          <dd>{home.size_sqm ? `${home.size_sqm} sqm` : "Not stated"}</dd>
          <dt className="text-zinc-500">Furnishing</dt>
          <dd>{furnishingLabel(home.furnishing)}</dd>
          <dt className="text-zinc-500">Available from</dt>
          <dd>{home.available_from ? new Date(home.available_from).toLocaleDateString("en-NG", { dateStyle: "long" }) : "To be confirmed"}</dd>
          <dt className="text-zinc-500">Listed</dt>
          <dd>{home.listed_at ? new Date(home.listed_at).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "—"}</dd>
        </section>

        {home.description ? (
          <section>
            <h2 className="text-lg font-semibold">About this home</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-700 dark:text-zinc-300">{home.description}</p>
          </section>
        ) : null}

        {amenities.length ? (
          <section>
            <h2 className="text-lg font-semibold">What it comes with</h2>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
              {amenities.map((a) => (
                <li key={a}>· {AMENITY_LABEL[a]}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">What it costs to move in</h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              <tr>
                <td className="py-2">Rent (one year)</td>
                <td className="py-2 text-right font-medium">{formatNgn(rent)}</td>
              </tr>
              <tr>
                <td className="py-2">Agency fee ({FEES.agencyPct}% of annual rent, one-time)</td>
                <td className="py-2 text-right">{formatNgn(agency)}</td>
              </tr>
              <tr>
                <td className="py-2">Legal fee ({FEES.legalPct}% of annual rent, one-time, covers the tenancy agreement)</td>
                <td className="py-2 text-right">{formatNgn(legal)}</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Total at move-in</td>
                <td className="py-2 text-right font-semibold">{formatNgn(rent + agency + legal)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-zinc-500">
            No caution fee or service charge is listed here because none is recorded for this home yet. HomeLy&apos;s annual management fee is paid by the landlord, not by you.
          </p>
        </section>

        <section className="rounded-xl bg-zinc-50 p-6 text-sm dark:bg-zinc-900">
          <p className="font-medium">Applications open in a later step.</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            There is nothing to submit yet. When applications open we notify you by email or WhatsApp, in queue order. Nothing else is needed from you now.
          </p>
        </section>
      </main>
    </>
  );
}
