"use server";

import { revalidatePath } from "next/cache";
import { assertTenantAction } from "@/lib/auth";
import { verifyTenantKyc } from "@/lib/kyc/dojah";
import { notifyTenant } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requiredText } from "@/lib/validation";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * After a direct-to-Storage upload from the browser (bucket `tenant-documents`,
 * key `<tenant id>/id_document/<uuid>-<file>`), record its metadata AS THE
 * TENANT under RLS. The object must already exist under the caller's folder.
 */
export async function recordTenantDocument(input: {
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<ActionResult<{ id: string }>> {
  let profile;
  try {
    profile = await assertTenantAction();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not signed in." };
  }
  const expectedPrefix = `${profile.id}/id_document/`;
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
  const { error: signErr } = await supabase.storage.from("tenant-documents").createSignedUrl(input.storagePath, 60);
  if (signErr) return { ok: false, error: "Upload not found in storage. Please try uploading again." };

  const { data, error } = await supabase
    .from("tenant_documents")
    .insert({
      tenant_id: profile.id,
      document_type: "id_document",
      storage_path: input.storagePath,
      original_filename: filename,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `Could not record the document: ${error?.message ?? "unknown error"}` };

  revalidatePath("/tenant");
  return { ok: true, data: { id: data.id } };
}

/**
 * not_started | rejected → pending. kyc_status is never client-writable, so
 * after verifying ownership + an uploaded ID through the tenant's own session,
 * the flip uses the service role. verifyTenantKyc() is the Dojah STUB: it
 * always routes to manual review for now.
 */
export async function submitTenantKyc(): Promise<ActionResult<{ status: "pending" }>> {
  let profile;
  try {
    profile = await assertTenantAction();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not signed in." };
  }

  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("id, kyc_status, waitlist_entry_id").eq("id", profile.id).maybeSingle();
  if (!tenant) return { ok: false, error: "No tenant record found for your account." };
  if (tenant.kyc_status !== "not_started" && tenant.kyc_status !== "rejected") {
    return { ok: false, error: "Your ID is already under review or verified." };
  }
  const { data: docs } = await supabase.from("tenant_documents").select("storage_path").eq("tenant_id", profile.id);
  if (!docs || docs.length === 0) return { ok: false, error: "Upload your ID before submitting for review." };

  const check = await verifyTenantKyc({ tenantId: profile.id, documentPaths: docs.map((d) => d.storage_path) });
  if (!check.ok) return { ok: false, error: check.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenants")
    .update({ kyc_status: "pending", kyc_rejection_reason: null })
    .eq("id", profile.id)
    .in("kyc_status", ["not_started", "rejected"]);
  if (error) return { ok: false, error: error.message };
  if (tenant.waitlist_entry_id) {
    await admin.from("waitlist_entries").update({ conversion_status: "kyc_pending" }).eq("id", tenant.waitlist_entry_id);
  }

  await notifyTenant({
    tenantId: profile.id,
    event: "tenant_kyc_submitted",
    subject: "We have received your ID",
    message: "Thanks — your ID is with our team for manual review. This usually takes 1–3 working days. We will email you as soon as it is done.",
  });

  revalidatePath("/tenant");
  revalidatePath("/admin/tenants");
  revalidatePath("/admin/waitlist");
  return { ok: true, data: { status: "pending" } };
}
