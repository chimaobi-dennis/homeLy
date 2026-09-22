"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdminAction } from "@/lib/auth";
import { SITE_MEDIA_BUCKET, SITE_MEDIA_MAX_BYTES, siteMediaKind } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { isUuid, optionalText, toInt } from "@/lib/validation";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const PAGE = "/admin/homepage";

function back(params?: Record<string, string>): never {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  redirect(`${PAGE}${qs}`);
}

function revalidateHome() {
  revalidatePath("/");
  revalidatePath(PAGE);
}

/**
 * Records a file the browser has already uploaded to the PUBLIC site-media
 * bucket (admin storage policy). Verifies the object exists before inserting.
 */
export async function recordHomepageMedia(input: { storagePath: string; mimeType: string; sizeBytes: number; caption: string }): Promise<ActionResult<{ id: string }>> {
  let profile;
  try {
    profile = await assertAdminAction();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not signed in." };
  }
  if (typeof input.storagePath !== "string" || !input.storagePath.startsWith("homepage/") || input.storagePath.includes("..")) {
    return { ok: false, error: "Invalid upload path." };
  }
  const kind = siteMediaKind(input.mimeType);
  if (!kind) return { ok: false, error: "Only JPEG, PNG, WebP images or MP4, WebM, MOV videos are accepted." };
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > SITE_MEDIA_MAX_BYTES) return { ok: false, error: "File must be between 1 byte and 60 MB." };

  const supabase = await createClient();
  const folder = input.storagePath.slice(0, input.storagePath.lastIndexOf("/"));
  const name = input.storagePath.slice(input.storagePath.lastIndexOf("/") + 1);
  const { data: found } = await supabase.storage.from(SITE_MEDIA_BUCKET).list(folder, { search: name, limit: 1 });
  if (!found?.some((f) => f.name === name)) return { ok: false, error: "Upload not found in storage. Please try again." };

  const { data: last } = await supabase.from("homepage_media").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("homepage_media")
    .insert({ kind, storage_path: input.storagePath, caption: optionalText(input.caption, 200), sort_order: (last?.sort_order ?? -1) + 1, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `Could not record the file: ${error?.message ?? "unknown error"}` };
  revalidateHome();
  return { ok: true, data: { id: data.id } };
}

export async function updateHomepageMedia(formData: FormData): Promise<void> {
  await assertAdminAction();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back({ error: "Invalid item." });
  const caption = optionalText(String(formData.get("caption") ?? ""), 200);
  const sort_order = toInt(String(formData.get("sort_order") ?? "0")) ?? 0;
  const is_active = formData.get("is_active") === "on";
  const supabase = await createClient();
  const { error } = await supabase.from("homepage_media").update({ caption, sort_order, is_active }).eq("id", id);
  revalidateHome();
  back(error ? { error: error.message } : { msg: "Saved." });
}

export async function deleteHomepageMedia(formData: FormData): Promise<void> {
  await assertAdminAction();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back({ error: "Invalid item." });
  const supabase = await createClient();
  const { data: row } = await supabase.from("homepage_media").select("storage_path").eq("id", id).maybeSingle();
  if (!row) back({ error: "Item not found." });
  const { error: rmErr } = await supabase.storage.from(SITE_MEDIA_BUCKET).remove([row.storage_path]);
  if (rmErr) back({ error: `Could not delete the file: ${rmErr.message}` });
  const { error } = await supabase.from("homepage_media").delete().eq("id", id);
  revalidateHome();
  back(error ? { error: error.message } : { msg: "Deleted." });
}

/** Feature a LISTED property on the homepage ("Property of the day"). The latest featured wins. */
export async function featureProperty(formData: FormData): Promise<void> {
  await assertAdminAction();
  const propertyId = String(formData.get("propertyId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? PAGE);
  if (!isUuid(propertyId)) back({ error: "Invalid property." });
  const supabase = await createClient();
  const { data: prop } = await supabase.from("properties").select("status").eq("id", propertyId).maybeSingle();
  if (!prop) back({ error: "Property not found." });
  if (prop.status !== "listed") back({ error: "Only a listed property can be featured." });
  const { error } = await supabase.from("properties").update({ featured_at: new Date().toISOString() }).eq("id", propertyId);
  revalidateHome();
  revalidatePath(`/admin/properties/${propertyId}`);
  redirect(returnTo.startsWith("/admin/") ? `${returnTo}?${new URLSearchParams(error ? { error: error.message } : { msg: "Featured on the homepage." })}` : PAGE);
}

export async function unfeatureProperty(formData: FormData): Promise<void> {
  await assertAdminAction();
  const propertyId = String(formData.get("propertyId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? PAGE);
  if (!isUuid(propertyId)) back({ error: "Invalid property." });
  const supabase = await createClient();
  const { error } = await supabase.from("properties").update({ featured_at: null }).eq("id", propertyId);
  revalidateHome();
  revalidatePath(`/admin/properties/${propertyId}`);
  redirect(returnTo.startsWith("/admin/") ? `${returnTo}?${new URLSearchParams(error ? { error: error.message } : { msg: "No longer featured." })}` : PAGE);
}
