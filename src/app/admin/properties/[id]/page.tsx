import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { requireStaffOrAdminPage } from "@/lib/auth";
import { formatNgn } from "@/lib/fees";
import { AMENITIES, AMENITY_LABEL, FURNISHING_OPTIONS, PHOTO_BUCKET, publishBlockers } from "@/lib/listings";
import { isAdmin } from "@/lib/roles";
import { PROPERTY_STATUS } from "@/lib/status-labels";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";
import { deletePhoto, movePhoto, publishProperty, unpublishProperty, updateListing, updatePhotoCaption } from "../actions";
import { PhotoUploader } from "./photo-uploader";

export const metadata: Metadata = { title: "Edit listing · HomeLy admin" };

const box = "rounded-md border border-zinc-300 p-4 dark:border-zinc-700";
const btn = "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900";
const btnSmall = "rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900";
const btnDanger = "rounded border border-red-700 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 dark:text-red-300";
const input = "w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

/** Listing editor. Staff edit content and photos; only admin sees Publish / Unpublish. */
export default async function AdminPropertyEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const viewer = await requireStaffOrAdminPage("/admin/properties");
  const admin = isAdmin(viewer.roleTags);
  const { id } = await params;
  const { msg, error } = await searchParams;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: property }, { data: photos }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase.from("property_photos").select("*").eq("property_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);
  if (!property) notFound();
  const { data: landlordProfile } = await supabase.from("profiles").select("full_name").eq("id", property.landlord_id).maybeSingle();

  const list = photos ?? [];
  const signed = new Map<string, string>();
  if (list.length) {
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(
      list.map((p) => p.storage_path),
      600,
    );
    for (const s of data ?? []) if (s.signedUrl && s.path) signed.set(s.path, s.signedUrl);
  }

  const ps = PROPERTY_STATUS[property.status];
  const blockers = publishBlockers(property, list.length);
  const amenitySet = new Set(property.amenities);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <Link href="/admin/properties" className="text-sm underline">
        ← All properties
      </Link>
      {msg ? <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p> : null}
      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <section className={box}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{property.address}</h1>
            <p className="text-sm text-zinc-500">
              {property.city} · {property.bedrooms} bed · target {formatNgn(property.target_annual_rent)} / yr · landlord{" "}
              {landlordProfile?.full_name ?? "—"} (
              <Link href={`/admin/landlords/${property.landlord_id}`} className="underline">
                review
              </Link>
              )
            </p>
            <p className="text-xs text-zinc-500">
              Address, bedrooms and rent are the landlord&apos;s facts (edited on their side while submitted); this page is the listing HomeLy writes on top.
            </p>
          </div>
          <div className="text-right">
            <StatusBadge label={ps.label} tone={ps.tone} />
            {property.listed_at ? <div className="mt-1 text-xs text-zinc-500">listed {new Date(property.listed_at).toLocaleString("en-NG")}</div> : null}
          </div>
        </div>
      </section>

      {/* ---------------- Listing content ---------------- */}
      <section className={box}>
        <h2 className="font-semibold">Listing content</h2>
        <form action={updateListing} className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <input type="hidden" name="propertyId" value={property.id} />
          <label className="flex flex-col gap-1 md:col-span-2">
            <span>Headline (max 120)</span>
            <input name="listing_headline" maxLength={120} defaultValue={property.listing_headline ?? ""} className={input} placeholder="e.g. Bright 2-bedroom flat in Independence Layout" />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span>Area / neighbourhood (shown publicly instead of the street address)</span>
            <input name="area" maxLength={80} defaultValue={property.area ?? ""} className={input} placeholder="e.g. Independence Layout, GRA, Trans Ekulu" />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span>Description (required to publish)</span>
            <textarea name="description" rows={6} maxLength={5000} defaultValue={property.description ?? ""} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span>Bathrooms</span>
            <input name="bathrooms" type="number" min={0} max={20} defaultValue={property.bathrooms ?? ""} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span>Size (sqm)</span>
            <input name="size_sqm" type="number" min={1} step="0.1" defaultValue={property.size_sqm ?? ""} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span>Furnishing</span>
            <select name="furnishing" defaultValue={property.furnishing ?? ""} className={input}>
              <option value="">Not stated</option>
              {FURNISHING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span>Available from</span>
            <input name="available_from" type="date" defaultValue={property.available_from ?? ""} className={input} />
          </label>
          <fieldset className="md:col-span-2">
            <legend className="mb-1">Amenities</legend>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {AMENITIES.map((a) => (
                <label key={a} className="flex items-center gap-2">
                  <input type="checkbox" name="amenities" value={a} defaultChecked={amenitySet.has(a)} /> {AMENITY_LABEL[a]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <button type="submit" className={btn}>
              Save listing
            </button>
          </div>
        </form>
      </section>

      {/* ---------------- Photos ---------------- */}
      <section className={box}>
        <h2 className="font-semibold">Photos ({list.length})</h2>
        <p className="mt-1 text-xs text-zinc-500">JPEG, PNG or WebP up to 8 MB each. Private bucket; viewers get short-lived signed URLs. First photo is the cover.</p>
        <div className="mt-3">
          <PhotoUploader propertyId={property.id} />
        </div>
        {list.length ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((photo, i) => (
              <li key={photo.id} className="rounded border border-zinc-200 p-2 text-xs dark:border-zinc-800">
                {signed.get(photo.storage_path) ? (
                  // Plain <img>: signed URLs are unique per render and expire, which defeats next/image's optimizer cache.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signed.get(photo.storage_path)} alt={photo.caption ?? `Photo ${i + 1}`} className="aspect-[4/3] w-full rounded object-cover" loading="lazy" />
                ) : (
                  <div className="aspect-[4/3] w-full rounded bg-zinc-100 dark:bg-zinc-900" />
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-zinc-500">
                    #{i + 1}
                    {i === 0 ? " · cover" : ""}
                  </span>
                  <div className="flex gap-1">
                    <form action={movePhoto}>
                      <input type="hidden" name="propertyId" value={property.id} />
                      <input type="hidden" name="photoId" value={photo.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" className={btnSmall} disabled={i === 0} aria-label="Move up">
                        ↑
                      </button>
                    </form>
                    <form action={movePhoto}>
                      <input type="hidden" name="propertyId" value={property.id} />
                      <input type="hidden" name="photoId" value={photo.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button type="submit" className={btnSmall} disabled={i === list.length - 1} aria-label="Move down">
                        ↓
                      </button>
                    </form>
                    <form action={deletePhoto}>
                      <input type="hidden" name="propertyId" value={property.id} />
                      <input type="hidden" name="photoId" value={photo.id} />
                      <button type="submit" className={btnDanger}>
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
                <form action={updatePhotoCaption} className="mt-2 flex gap-1">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <input name="caption" maxLength={200} defaultValue={photo.caption ?? ""} placeholder="Caption" className={input} aria-label={`Caption for photo ${i + 1}`} />
                  <button type="submit" className={btnSmall}>
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No photos yet.</p>
        )}
      </section>

      {/* ---------------- Publish ---------------- */}
      <section className={box}>
        <h2 className="font-semibold">Publish</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Publishing moves the property from “{PROPERTY_STATUS.under_inspection.label}” to “{PROPERTY_STATUS.listed.label}” and makes it visible to verified tenants. Admin only.
        </p>
        {blockers.length ? (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">Still missing: {blockers.join(", ")}.</p>
        ) : (
          <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">Content requirements met.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {admin ? (
            <>
              {property.status === "under_inspection" ? (
                <form action={publishProperty}>
                  <input type="hidden" name="propertyId" value={property.id} />
                  <button type="submit" className={btn} disabled={blockers.length > 0}>
                    Publish listing
                  </button>
                </form>
              ) : null}
              {property.status === "listed" ? (
                <form action={unpublishProperty}>
                  <input type="hidden" name="propertyId" value={property.id} />
                  <button type="submit" className="rounded border border-red-700 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-300">
                    Unpublish
                  </button>
                </form>
              ) : null}
              {property.status === "submitted" || property.status === "rejected" ? (
                <p className="text-sm text-zinc-500">
                  Move it to “{PROPERTY_STATUS.under_inspection.label}” on the{" "}
                  <Link href={`/admin/landlords/${property.landlord_id}`} className="underline">
                    landlord review page
                  </Link>{" "}
                  first.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-zinc-500">Only an admin can publish or unpublish. Your edits above are saved and will go live when an admin publishes.</p>
          )}
        </div>
      </section>
    </main>
  );
}
