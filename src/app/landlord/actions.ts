"use server";

import { revalidatePath } from "next/cache";
import { assertLandlordAction, getSessionProfile } from "@/lib/auth";
import {
  DEFAULT_MAINTENANCE_THRESHOLD_NGN,
  MAX_MAINTENANCE_THRESHOLD_NGN,
  MIN_MAINTENANCE_THRESHOLD_NGN,
} from "@/lib/fees";
import { notifyLandlord } from "@/lib/notifications";
import type { DocumentType } from "@/lib/status-labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isEmail, isPhone, isUuid, requiredText, toInt, toMoney } from "@/lib/validation";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const DOCUMENT_TYPES: readonly DocumentType[] = ["id_document", "proof_of_ownership"];
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Step 1 of the wizard: create the landlord's auth account.
// A self-service sign-up gets role_tags {landlord} from the DB trigger.
// ---------------------------------------------------------------------------
export async function createLandlordAccount(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<ActionResult<{ needsEmailConfirmation: boolean; userId: string }>> {
  const fullName = requiredText(input.fullName, "Full name", 120);
  if (typeof fullName !== "string") return { ok: false, error: fullName.error };
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!isEmail(email)) return { ok: false, error: "Enter a valid email address." };
  const phone = String(input.phone ?? "").trim();
  if (!isPhone(phone)) return { ok: false, error: "Enter a valid phone / WhatsApp number (digits, optional leading +)." };
  const password = String(input.password ?? "");
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // user_metadata is client-controlled and is used for full_name / phone only.
    // role_tags can NOT be set from here (trigger reads app_metadata only).
    options: { data: { full_name: fullName, phone } },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return { ok: false, error: "An account with this email already exists. Sign in to continue your application." };
    }
    return { ok: false, error: error.message };
  }
  if (!data.user) return { ok: false, error: "Could not create your account. Please try again." };

  // With email confirmation enabled (cloud), there is no session until the link is clicked.
  return { ok: true, data: { needsEmailConfirmation: !data.session, userId: data.user.id } };
}

// ---------------------------------------------------------------------------
// Final wizard submit: landlords row (if new) + properties row, AS THE LANDLORD.
// Goes through RLS: landlord inserts own row; status defaults are trigger-enforced.
// ---------------------------------------------------------------------------
export async function submitApplication(input: {
  countryOfResidence: string;
  address: string;
  city: string;
  bedrooms: number | string;
  targetAnnualRent: number | string;
  maintenanceThresholdNgn: number | string;
}): Promise<ActionResult<{ propertyId: string; landlordCreated: boolean }>> {
  let profile;
  try {
    profile = await assertLandlordAction();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not signed in." };
  }

  const country = requiredText(input.countryOfResidence, "Country of residence", 80);
  if (typeof country !== "string") return { ok: false, error: country.error };
  const address = requiredText(input.address, "Property address", 400);
  if (typeof address !== "string") return { ok: false, error: address.error };
  const city = requiredText(input.city, "City", 80);
  if (typeof city !== "string") return { ok: false, error: city.error };
  const bedrooms = toInt(input.bedrooms);
  if (bedrooms === null || bedrooms < 0 || bedrooms > 50) return { ok: false, error: "Bedrooms must be a whole number between 0 and 50." };
  const rent = toMoney(input.targetAnnualRent);
  if (rent === null || rent <= 0) return { ok: false, error: "Target annual rent must be a positive amount in naira." };
  const threshold = toMoney(input.maintenanceThresholdNgn) ?? DEFAULT_MAINTENANCE_THRESHOLD_NGN;
  if (threshold < MIN_MAINTENANCE_THRESHOLD_NGN || threshold > MAX_MAINTENANCE_THRESHOLD_NGN) {
    return { ok: false, error: "Maintenance threshold is out of range." };
  }

  const supabase = await createClient();

  const { data: existing, error: readErr } = await supabase
    .from("landlords")
    .select("id")
    .eq("id", profile.id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };

  let landlordCreated = false;
  if (!existing) {
    const { error } = await supabase
      .from("landlords")
      .insert({ id: profile.id, country_of_residence: country });
    if (error) return { ok: false, error: `Could not save your details: ${error.message}` };
    landlordCreated = true;
  }

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .insert({
      landlord_id: profile.id,
      address,
      city,
      bedrooms,
      target_annual_rent: rent,
      maintenance_threshold_ngn: threshold,
    })
    .select("id")
    .single();
  if (propErr || !property) return { ok: false, error: `Could not save the property: ${propErr?.message ?? "unknown error"}` };

  revalidatePath("/landlord/dashboard");
  return { ok: true, data: { propertyId: property.id, landlordCreated } };
}

// ---------------------------------------------------------------------------
// After a direct-to-Storage upload from the browser, record its metadata.
// The object must already exist under the caller's own folder.
// ---------------------------------------------------------------------------
export async function recordDocument(input: {
  documentType: DocumentType;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  propertyId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  let profile;
  try {
    profile = await assertLandlordAction();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not signed in." };
  }

  if (!DOCUMENT_TYPES.includes(input.documentType)) return { ok: false, error: "Unknown document type." };
  const expectedPrefix = `${profile.id}/${input.documentType}/`;
  if (typeof input.storagePath !== "string" || !input.storagePath.startsWith(expectedPrefix) || input.storagePath.includes("..")) {
    return { ok: false, error: "Invalid upload path." };
  }
  if (!ALLOWED_MIME.includes(input.mimeType)) return { ok: false, error: "Only JPEG, PNG, WebP or PDF files are accepted." };
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File must be between 1 byte and 10 MB." };
  }
  const filename = requiredText(input.originalFilename, "File name", 255);
  if (typeof filename !== "string") return { ok: false, error: filename.error };

  const supabase = await createClient();

  // Proof of ownership is tied to ONE of the landlord's own properties. With a
  // single property it defaults to that one; with several, the landlord must
  // choose. An ID document is never tied to a property.
  let propertyId: string | null = null;
  if (input.documentType === "proof_of_ownership") {
    const { data: owned } = await supabase.from("properties").select("id").eq("landlord_id", profile.id);
    const ownedIds = (owned ?? []).map((p) => p.id);
    if (ownedIds.length === 1 && !input.propertyId) {
      propertyId = ownedIds[0];
    } else if (ownedIds.length > 0) {
      if (!input.propertyId) {
        return { ok: false, error: "Choose which property this proof of ownership is for." };
      }
      if (!isUuid(input.propertyId) || !ownedIds.includes(input.propertyId)) {
        return { ok: false, error: "That property is not one of yours." };
      }
      propertyId = input.propertyId;
    }
  }

  // Prove the object exists and is readable by this landlord (owner-read storage policy).
  const { error: signErr } = await supabase.storage
    .from("landlord-documents")
    .createSignedUrl(input.storagePath, 60);
  if (signErr) return { ok: false, error: "Upload not found in storage. Please try uploading again." };

  const { data, error } = await supabase
    .from("landlord_documents")
    .insert({
      landlord_id: profile.id,
      property_id: propertyId,
      document_type: input.documentType,
      storage_path: input.storagePath,
      original_filename: filename,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `Could not record the document: ${error?.message ?? "unknown error"}` };

  revalidatePath("/landlord/dashboard");
  return { ok: true, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// applied | kyc_rejected  →  kyc_pending
// `status` is never client-writable, so after verifying ownership + documents
// through the landlord's own session, the flip itself uses the service role.
// ---------------------------------------------------------------------------
export async function submitForReview(): Promise<ActionResult<{ status: "kyc_pending" }>> {
  let profile;
  try {
    profile = await assertLandlordAction();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not signed in." };
  }

  const supabase = await createClient();
  const { data: landlord } = await supabase
    .from("landlords")
    .select("id, status")
    .eq("id", profile.id)
    .maybeSingle();
  if (!landlord) return { ok: false, error: "No application found. Please apply first." };
  if (landlord.status !== "applied" && landlord.status !== "kyc_rejected") {
    return { ok: false, error: "Your application is already under review or has been verified." };
  }

  const { data: docs } = await supabase
    .from("landlord_documents")
    .select("document_type")
    .eq("landlord_id", profile.id);
  const types = new Set((docs ?? []).map((d) => d.document_type));
  const missing = DOCUMENT_TYPES.filter((t) => !types.has(t));
  if (missing.length) {
    return { ok: false, error: "Upload both your ID and proof of ownership before submitting for review." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("landlords")
    .update({ status: "kyc_pending", kyc_rejection_reason: null })
    .eq("id", profile.id)
    .in("status", ["applied", "kyc_rejected"]);
  if (error) return { ok: false, error: error.message };

  await notifyLandlord({
    landlordId: profile.id,
    event: "application_submitted",
    subject: "We have received your documents",
    message:
      "Thanks — your ID and proof of ownership are with our Enugu team for manual review. " +
      "This usually takes 1–3 working days. We will email you as soon as it is done.",
  });

  revalidatePath("/landlord/dashboard");
  revalidatePath("/admin/landlords");
  return { ok: true, data: { status: "kyc_pending" } };
}

// ---------------------------------------------------------------------------
// rejected property → edit details (as the landlord) → status back to submitted
// (service role, after ownership + status checks).
// ---------------------------------------------------------------------------
export async function resubmitProperty(input: {
  propertyId: string;
  address: string;
  city: string;
  bedrooms: number | string;
  targetAnnualRent: number | string;
  maintenanceThresholdNgn: number | string;
}): Promise<ActionResult> {
  let profile;
  try {
    profile = await assertLandlordAction();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not signed in." };
  }
  if (!isUuid(input.propertyId)) return { ok: false, error: "Invalid property." };

  const address = requiredText(input.address, "Property address", 400);
  if (typeof address !== "string") return { ok: false, error: address.error };
  const city = requiredText(input.city, "City", 80);
  if (typeof city !== "string") return { ok: false, error: city.error };
  const bedrooms = toInt(input.bedrooms);
  if (bedrooms === null || bedrooms < 0 || bedrooms > 50) return { ok: false, error: "Bedrooms must be a whole number between 0 and 50." };
  const rent = toMoney(input.targetAnnualRent);
  if (rent === null || rent <= 0) return { ok: false, error: "Target annual rent must be a positive amount in naira." };
  const threshold = toMoney(input.maintenanceThresholdNgn) ?? DEFAULT_MAINTENANCE_THRESHOLD_NGN;
  if (threshold < MIN_MAINTENANCE_THRESHOLD_NGN || threshold > MAX_MAINTENANCE_THRESHOLD_NGN) {
    return { ok: false, error: "Maintenance threshold is out of range." };
  }

  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, status")
    .eq("id", input.propertyId)
    .eq("landlord_id", profile.id)
    .maybeSingle();
  if (!property) return { ok: false, error: "Property not found." };
  if (property.status !== "rejected") return { ok: false, error: "Only a rejected property can be resubmitted." };

  // Core fields are locked by the guard trigger while status <> 'submitted'
  // (Step 3, A2), so the correction and the status flip happen together in ONE
  // service-role update scoped to this exact row and prior state. Ownership and
  // state were verified above through the landlord's own session. This is the
  // deliberate, "loud" edit path: status resets and the reason is cleared.
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("properties")
    .update({
      address,
      city,
      bedrooms,
      target_annual_rent: rent,
      maintenance_threshold_ngn: threshold,
      status: "submitted",
      rejection_reason: null,
    })
    .eq("id", property.id)
    .eq("landlord_id", profile.id)
    .eq("status", "rejected")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "This property is no longer awaiting resubmission." };

  revalidatePath("/landlord/dashboard");
  revalidatePath("/admin/landlords");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// maintenance_threshold_ngn is not inspection-linked: editable by the landlord
// at any status, as the landlord, under RLS (the guard trigger allows it).
// ---------------------------------------------------------------------------
export async function updateMaintenanceThreshold(input: {
  propertyId: string;
  maintenanceThresholdNgn: number | string;
}): Promise<ActionResult<{ maintenanceThresholdNgn: number }>> {
  let profile;
  try {
    profile = await assertLandlordAction();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not signed in." };
  }
  if (!isUuid(input.propertyId)) return { ok: false, error: "Invalid property." };
  const threshold = toMoney(input.maintenanceThresholdNgn);
  if (threshold === null || threshold < MIN_MAINTENANCE_THRESHOLD_NGN || threshold > MAX_MAINTENANCE_THRESHOLD_NGN) {
    return { ok: false, error: "Enter a maintenance limit between ₦0 and ₦50,000,000." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .update({ maintenance_threshold_ngn: threshold })
    .eq("id", input.propertyId)
    .eq("landlord_id", profile.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Property not found." };

  revalidatePath("/landlord/dashboard");
  revalidatePath("/admin/landlords");
  return { ok: true, data: { maintenanceThresholdNgn: threshold } };
}

/** Used by the wizard to decide whether to skip the account step. */
export async function getWizardContext(): Promise<{
  signedIn: boolean;
  isLandlord: boolean;
  countryOfResidence: string | null;
}> {
  const profile = await getSessionProfile();
  if (!profile) return { signedIn: false, isLandlord: false, countryOfResidence: null };
  const supabase = await createClient();
  const { data } = await supabase.from("landlords").select("country_of_residence").eq("id", profile.id).maybeSingle();
  return {
    signedIn: true,
    isLandlord: profile.roleTags.includes("landlord"),
    countryOfResidence: data?.country_of_residence ?? null,
  };
}
