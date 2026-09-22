import Image from "next/image";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { SITE_MEDIA_BUCKET } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { deleteHomepageMedia, featureProperty, unfeatureProperty, updateHomepageMedia } from "./actions";
import { MediaUploader } from "./media-uploader";

const input = "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const btn = "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900";

/**
 * Admin-only: what the public homepage shows — the "Why choose HomeLy" media
 * slider (images/videos) and the "Property of the day" (featured listing).
 */
export default async function AdminHomepagePage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requireAdminPage("/admin/homepage");
  const { msg, error } = await searchParams;
  const supabase = await createClient();

  const [{ data: media }, { data: listed }] = await Promise.all([
    supabase.from("homepage_media").select("id, kind, storage_path, caption, sort_order, is_active, created_at").order("sort_order").order("created_at"),
    supabase.from("properties").select("id, listing_headline, area, featured_at").eq("status", "listed").order("listed_at", { ascending: false }),
  ]);
  const featured = [...(listed ?? [])].filter((p) => p.featured_at).sort((a, b) => (b.featured_at ?? "").localeCompare(a.featured_at ?? ""))[0] ?? null;
  const publicUrl = (path: string) => supabase.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Homepage</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">What visitors see on the public homepage. Changes appear within a minute.</p>
        {msg ? <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{msg}</p> : null}
        {error ? (
          <p role="alert" className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>

      {/* Property of the day */}
      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Property of the day</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Shown in the dark band under “Why choose HomeLy”. If nothing is featured, the newest listed home is shown.
        </p>
        <p className="mt-3 text-sm">
          Currently featured:{" "}
          {featured ? (
            <>
              <Link href={`/admin/properties/${featured.id}`} className="font-medium underline underline-offset-4">
                {featured.listing_headline ?? featured.id}
              </Link>
              {featured.area ? ` · ${featured.area}` : ""}
            </>
          ) : (
            <span className="text-zinc-500">none (newest listing is used)</span>
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form action={featureProperty} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Listed properties</span>
              <select name="propertyId" className={input} defaultValue="" required>
                <option value="" disabled>
                  Choose a listed home…
                </option>
                {(listed ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.listing_headline ?? p.id}
                    {p.area ? ` · ${p.area}` : ""}
                    {p.featured_at ? " (featured)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={btn} disabled={(listed ?? []).length === 0}>
              Feature
            </button>
          </form>
          {featured ? (
            <form action={unfeatureProperty}>
              <input type="hidden" name="propertyId" value={featured.id} />
              <button type="submit" className="rounded border border-zinc-400 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800">
                Unfeature
              </button>
            </form>
          ) : null}
        </div>
      </section>

      {/* Media slider */}
      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">“Why choose HomeLy” media</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Images or videos for the slider next to the “Why choose HomeLy” card. Lower sort order shows first; inactive items are hidden. Up to 60 MB each; MP4 is the safest video format.
        </p>
        <div className="mt-4">
          <MediaUploader />
        </div>
        {media && media.length ? (
          <ul className="mt-6 flex flex-col gap-4">
            {media.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                  {m.kind === "image" ? (
                    <Image src={publicUrl(m.storage_path)} alt="" fill sizes="128px" className="object-cover" />
                  ) : (
                    <video src={publicUrl(m.storage_path)} className="h-full w-full object-cover" muted preload="metadata" />
                  )}
                </div>
                <form action={updateHomepageMedia} className="flex flex-1 flex-wrap items-end gap-3 text-sm">
                  <input type="hidden" name="id" value={m.id} />
                  <span className="rounded bg-zinc-100 px-2 py-1 text-xs uppercase tracking-wide dark:bg-zinc-800">{m.kind}</span>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">Caption</span>
                    <input name="caption" defaultValue={m.caption ?? ""} maxLength={200} className={`${input} w-64`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-zinc-500">Sort</span>
                    <input name="sort_order" type="number" defaultValue={m.sort_order} className={`${input} w-20`} />
                  </label>
                  <label className="flex items-center gap-2">
                    <input name="is_active" type="checkbox" defaultChecked={m.is_active} /> Active
                  </label>
                  <button type="submit" className={btn}>
                    Save
                  </button>
                </form>
                <form action={deleteHomepageMedia}>
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className="rounded border border-red-700 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-300">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-zinc-500">Nothing uploaded yet — the homepage shows the hero photo in the slider until you add something.</p>
        )}
      </section>
    </main>
  );
}
