"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdminAction, assertStaffOrAdminAction } from "@/lib/auth";
import { FURNISHING_OPTIONS, isAmenity, PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_MIME, publishBlockers, type Furnishing } from "@/lib/listings";
import { notifyLandlord } from "@/lib/notifications";
import { PROPERTY_STATUS } from "@/lib/status-labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid, optionalText, toInt } from "@/lib/validation";

/**
 * Listing management. Same pattern as the other admin action files:
 *   - listing content + photos: STAFF OR ADMIN, written through the caller's
 *     own session (RLS "properties: staff updates any row" / property_photos
 *     policies); the guard trigger keeps staff to listing columns only;
 *   - publish / unpublish: ADMIN ONLY, service role for `status` (listed_at is
 *     set/cleared by trigger; the DB also enforces the publish requirements).
 */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function back(propertyId: string, params: { msg?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (params.msg) q.set("msg", params.msg);
  if (params.error) q.set("error", params.error);
  redirect(`/admin/properties/${propertyId}${q.size ? `?${q.toString()}` : ""}`);
}

function revalidate(propertyId: string) {
  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/landlord/dashboard");
  revalidatePath("/tenant/browse");
  revalidatePath(`/tenant/browse/${propertyId}`);
  revalidatePath("/");
  revalidatePath("/search");
}

// ---------------------------------------------------------------------------
// Listing content
// ---------------------------------------------------------------------------
export async function updateListing(formData: FormData): Promise<void> {
  const propertyId = String(formData.get("propertyId") ?? "");
  if (!isUuid(propertyId)) redirect("/admin/properties?error=Invalid+property");

  let error: string | null = null;
  try {
    await assertStaffOrAdminAction();

    const listing_headline = optionalText(formData.get("listing_headline"), 120);
    const area = optionalText(formData.get("area"), 80);
    const description = optionalText(formData.get("description"), 5000);
    const bathroomsRaw = String(formData.get("bathrooms") ?? "").trim();
    const bathrooms = bathroomsRaw === "" ? null : toInt(bathroomsRaw);
    if (bathroomsRaw !== "" && (bathrooms === null || bathrooms < 0 || bathrooms > 20)) throw new Error("Bathrooms must be a whole number between 0 and 20.");
    const sizeRaw = String(formData.get("size_sqm") ?? "").trim();
    const size_sqm = sizeRaw === "" ? null : Number(sizeRaw);
    if (sizeRaw !== "" && (!Number.isFinite(size_sqm) || (size_sqm as number) <= 0)) throw new Error("Size must be a positive number of square metres.");
    const furnishingRaw = String(formData.get("furnishing") ?? "");
    const furnishing = FURNISHING_OPTIONS.some((o) => o.value === furnishingRaw) ? (furnishingRaw as Furnishing) : null;
    const amenities = formData.getAll("amenities").map(String).filter(isAmenity);
    const availableRaw = String(formData.get("available_from") ?? "").trim();
    if (availableRaw && !/^\d{4}-\d{2}-\d{2}$/.test(availableRaw)) throw new Error("Available-from must be a date.");
    const available_from = availableRaw || null;

    const supabase = await createClient(); // staff/admin session → RLS + guard trigger
    const { data, error: dbErr } = await supabase
      .from("properties")
      .update({ listing_headline, area, description, bathrooms, size_sqm, furnishing, amenities, available_from })
      .eq("id", propertyId)
      .select("id")
      .maybeSingle();
    if (dbErr) throw new Error(dbErr.message);
    if (!data) throw new Error("Property not found.");
    revalidate(propertyId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(propertyId, error ? { error } : { msg: "Listing saved." });
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------
export async function recordPropertyPhoto(input: { propertyId: string; storagePath: string; mimeType: string; sizeBytes: number }): Promise<ActionResult<{ id: string }>> {
  let profile;
  try {
    profile = await assertStaffOrAdminAction();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not signed in." };
  }
  if (!isUuid(input.propertyId)) return { ok: false, error: "Invalid property." };
  if (typeof input.storagePath !== "string" || !input.storagePath.startsWith(`${input.propertyId}/`) || input.storagePath.includes("..")) {
    return { ok: false, error: "Invalid upload path." };
  }
  if (!(PHOTO_MIME as readonly string[]).includes(input.mimeType)) return { ok: false, error: "Only JPEG, PNG or WebP images are accepted." };
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > PHOTO_MAX_BYTES) return { ok: false, error: "Image must be between 1 byte and 8 MB." };

  const supabase = await createClient();
  const { error: signErr } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(input.storagePath, 60);
  if (signErr) return { ok: false, error: "Upload not found in storage. Please try again." };

  const { data: last } = await supabase
    .from("property_photos")
    .select("sort_order")
    .eq("property_id", input.propertyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (last?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("property_photos")
    .insert({ property_id: input.propertyId, storage_path: input.storagePath, sort_order, uploaded_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `Could not record the photo: ${error?.message ?? "unknown error"}` };
  revalidate(input.propertyId);
  return { ok: true, data: { id: data.id } };
}

export async function updatePhotoCaption(formData: FormData): Promise<void> {
  const propertyId = String(formData.get("propertyId") ?? "");
  if (!isUuid(propertyId)) redirect("/admin/properties?error=Invalid+property");
  let error: string | null = null;
  try {
    await assertStaffOrAdminAction();
    const photoId = String(formData.get("photoId") ?? "");
    if (!isUuid(photoId)) throw new Error("Invalid photo.");
    const caption = optionalText(formData.get("caption"), 200);
    const supabase = await createClient();
    const { error: dbErr } = await supabase.from("property_photos").update({ caption }).eq("id", photoId).eq("property_id", propertyId);
    if (dbErr) throw new Error(dbErr.message);
    revalidate(propertyId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(propertyId, error ? { error } : { msg: "Caption saved." });
}

export async function movePhoto(formData: FormData): Promise<void> {
  const propertyId = String(formData.get("propertyId") ?? "");
  if (!isUuid(propertyId)) redirect("/admin/properties?error=Invalid+property");
  let error: string | null = null;
  try {
    await assertStaffOrAdminAction();
    const photoId = String(formData.get("photoId") ?? "");
    const direction = String(formData.get("direction") ?? "");
    if (!isUuid(photoId) || (direction !== "up" && direction !== "down")) throw new Error("Invalid move.");

    const supabase = await createClient();
    const { data: photos } = await supabase
      .from("property_photos")
      .select("id, sort_order")
      .eq("property_id", propertyId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    const list = photos ?? [];
    const idx = list.findIndex((p) => p.id === photoId);
    if (idx < 0) throw new Error("Photo not found.");
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) {
      back(propertyId, { msg: "Already at that end." });
    }
    // Normalise to dense 0..n-1 then swap the two positions.
    const order = list.map((p, i) => ({ id: p.id, sort_order: i }));
    const a = order[idx];
    const b = order[swapWith];
    [a.sort_order, b.sort_order] = [b.sort_order, a.sort_order];
    for (const row of order) {
      const { error: dbErr } = await supabase.from("property_photos").update({ sort_order: row.sort_order }).eq("id", row.id);
      if (dbErr) throw new Error(dbErr.message);
    }
    revalidate(propertyId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(propertyId, error ? { error } : { msg: "Order updated." });
}

export async function deletePhoto(formData: FormData): Promise<void> {
  const propertyId = String(formData.get("propertyId") ?? "");
  if (!isUuid(propertyId)) redirect("/admin/properties?error=Invalid+property");
  let error: string | null = null;
  try {
    await assertStaffOrAdminAction();
    const photoId = String(formData.get("photoId") ?? "");
    if (!isUuid(photoId)) throw new Error("Invalid photo.");

    const supabase = await createClient();
    const { data: photo } = await supabase.from("property_photos").select("id, storage_path").eq("id", photoId).eq("property_id", propertyId).maybeSingle();
    if (!photo) throw new Error("Photo not found.");

    // Object first (staff delete policy on the bucket), then the row. If the
    // object is already gone, still remove the row so the listing stays honest.
    const { error: rmErr } = await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
    if (rmErr) console.warn("[deletePhoto] storage remove:", rmErr.message);
    const { error: dbErr } = await supabase.from("property_photos").delete().eq("id", photoId);
    if (dbErr) throw new Error(dbErr.message);
    revalidate(propertyId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(propertyId, error ? { error } : { msg: "Photo deleted." });
}

// ---------------------------------------------------------------------------
// Publish / unpublish — ADMIN ONLY (same pattern as tenant KYC review)
// ---------------------------------------------------------------------------
export async function publishProperty(formData: FormData): Promise<void> {
  const propertyId = String(formData.get("propertyId") ?? "");
  if (!isUuid(propertyId)) redirect("/admin/properties?error=Invalid+property");
  let error: string | null = null;
  try {
    await assertAdminAction();
    const supabase = await createClient();
    const [{ data: property }, { count }] = await Promise.all([
      supabase.from("properties").select("id, status, description, target_annual_rent, address, landlord_id").eq("id", propertyId).maybeSingle(),
      supabase.from("property_photos").select("id", { count: "exact", head: true }).eq("property_id", propertyId),
    ]);
    if (!property) throw new Error("Property not found.");
    if (property.status !== "under_inspection") {
      throw new Error(`Only a property that is "${PROPERTY_STATUS.under_inspection.label}" can be published (this one is "${PROPERTY_STATUS[property.status].label}"). Move it there from the landlord's review page first.`);
    }
    const blockers = publishBlockers(property, count ?? 0);
    if (blockers.length) throw new Error(`Cannot publish yet — still missing ${blockers.join(", ")}.`);

    const service = createAdminClient();
    const { error: dbErr } = await service.from("properties").update({ status: "listed", rejection_reason: null }).eq("id", propertyId).eq("status", "under_inspection");
    if (dbErr) throw new Error(dbErr.message);

    await notifyLandlord({
      landlordId: property.landlord_id,
      event: "property_status_changed",
      subject: `${property.address} is now listed`,
      message: `${property.address} is live: HomeLy is marketing it and screening tenants. ${PROPERTY_STATUS.listed.description}`,
    });
    revalidate(propertyId);
    revalidatePath("/admin/landlords");
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(propertyId, error ? { error } : { msg: "Published. Verified tenants can now see this listing." });
}

export async function unpublishProperty(formData: FormData): Promise<void> {
  const propertyId = String(formData.get("propertyId") ?? "");
  if (!isUuid(propertyId)) redirect("/admin/properties?error=Invalid+property");
  let error: string | null = null;
  try {
    await assertAdminAction();
    const service = createAdminClient();
    const { data, error: dbErr } = await service
      .from("properties")
      .update({ status: "under_inspection" })
      .eq("id", propertyId)
      .eq("status", "listed")
      .select("id, address, landlord_id")
      .maybeSingle();
    if (dbErr) throw new Error(dbErr.message);
    if (!data) throw new Error("Property is not listed, so there is nothing to unpublish.");
    await notifyLandlord({
      landlordId: data.landlord_id,
      event: "property_status_changed",
      subject: `${data.address} has been taken off the list`,
      message: `${data.address} is no longer listed and is back under inspection. We will be in touch if anything is needed from you.`,
    });
    revalidate(propertyId);
    revalidatePath("/admin/landlords");
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(propertyId, error ? { error } : { msg: "Unpublished. The listing is hidden from tenants again." });
}
