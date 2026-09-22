import "server-only";

import { SITE_MEDIA_BUCKET } from "@/lib/listings";
import { createPublicClient } from "@/lib/supabase/public";

export type HomepageMediaItem = { id: string; kind: "image" | "video"; url: string; caption: string | null };

/** Active homepage media in display order, as public URLs (the bucket is public). */
export async function getHomepageMedia(): Promise<HomepageMediaItem[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("homepage_media")
    .select("id, kind, storage_path, caption")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind === "video" ? "video" : "image",
    url: supabase.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(r.storage_path).data.publicUrl,
    caption: r.caption,
  }));
}
