"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendAgreementForSigning } from "@/lib/agreements/flowmono";
import { assertAdminAction } from "@/lib/auth";
import { notifyLandlord } from "@/lib/notifications";
import { PROPERTY_STATUS } from "@/lib/status-labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid, optionalText } from "@/lib/validation";

/**
 * Every action here:
 *   1. re-reads the caller's role_tags from the DB via their own session
 *      (assertAdminAction) — a client-supplied "I am admin" is never trusted;
 *   2. performs the protected write with the service role, because `status`,
 *      `*_reason` and `agreement_status` are blocked for client sessions by
 *      the guard triggers;
 *   3. notifies the landlord through notifyLandlord (stubbed);
 *   4. redirects back with ?msg= / ?error=.
 */

function back(landlordId: string, params: { msg?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (params.msg) q.set("msg", params.msg);
  if (params.error) q.set("error", params.error);
  redirect(`/admin/landlords/${landlordId}?${q.toString()}`);
}

function revalidate(landlordId: string) {
  revalidatePath("/admin/landlords");
  revalidatePath(`/admin/landlords/${landlordId}`);
  revalidatePath("/landlord/dashboard");
}

export async function setLandlordKyc(formData: FormData): Promise<void> {
  const landlordId = String(formData.get("landlordId") ?? "");
  if (!isUuid(landlordId)) redirect("/admin/landlords?error=Invalid+landlord");

  let error: string | null = null;
  let msg: string | null = null;
  try {
    await assertAdminAction();
    const decision = String(formData.get("decision") ?? "");
    const reason = optionalText(formData.get("reason"), 2000);
    if (decision !== "kyc_verified" && decision !== "kyc_rejected") throw new Error("Choose verified or rejected.");
    if (decision === "kyc_rejected" && !reason) throw new Error("A reason is required when rejecting — the landlord will see it.");

    const admin = createAdminClient();
    const { data, error: dbErr } = await admin
      .from("landlords")
      .update({ status: decision, kyc_rejection_reason: decision === "kyc_rejected" ? reason : null })
      .eq("id", landlordId)
      .select("id")
      .maybeSingle();
    if (dbErr) throw new Error(dbErr.message);
    if (!data) throw new Error("Landlord not found.");

    await notifyLandlord({
      landlordId,
      event: decision === "kyc_verified" ? "kyc_verified" : "kyc_rejected",
      subject: decision === "kyc_verified" ? "Your HomeLy account is verified" : "We could not approve your application yet",
      message:
        decision === "kyc_verified"
          ? "Your identity and ownership documents are confirmed. Next we send you the management agreement to sign."
          : `We could not approve your application with the documents provided.\n\nReason: ${reason}\n\nUpload corrected documents on your dashboard and resubmit.`,
    });
    revalidate(landlordId);
    msg = decision === "kyc_verified" ? "Landlord marked verified." : "Landlord marked rejected; reason saved.";
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(landlordId, error ? { error } : { msg: msg ?? undefined });
}

export async function setPropertyStatus(formData: FormData): Promise<void> {
  const landlordId = String(formData.get("landlordId") ?? "");
  const propertyId = String(formData.get("propertyId") ?? "");
  if (!isUuid(landlordId)) redirect("/admin/landlords?error=Invalid+landlord");

  let error: string | null = null;
  let msg: string | null = null;
  try {
    await assertAdminAction();
    if (!isUuid(propertyId)) throw new Error("Invalid property.");
    const status = String(formData.get("status") ?? "");
    const reason = optionalText(formData.get("reason"), 2000);
    if (status !== "under_inspection" && status !== "listed" && status !== "rejected") throw new Error("Choose a status.");
    if (status === "rejected" && !reason) throw new Error("A reason is required when rejecting — the landlord will see it.");

    const admin = createAdminClient();
    const { data, error: dbErr } = await admin
      .from("properties")
      .update({ status, rejection_reason: status === "rejected" ? reason : null })
      .eq("id", propertyId)
      .eq("landlord_id", landlordId)
      .select("id, address")
      .maybeSingle();
    if (dbErr) throw new Error(dbErr.message);
    if (!data) throw new Error("Property not found for this landlord.");

    await notifyLandlord({
      landlordId,
      event: "property_status_changed",
      subject: `Update on ${data.address}: ${PROPERTY_STATUS[status].label}`,
      message:
        `${data.address} is now "${PROPERTY_STATUS[status].label}". ${PROPERTY_STATUS[status].description}` +
        (status === "rejected" ? `\n\nReason: ${reason}` : ""),
    });
    revalidate(landlordId);
    msg = `Property set to ${PROPERTY_STATUS[status].label}.`;
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(landlordId, error ? { error } : { msg: msg ?? undefined });
}

/** kyc_verified + not_sent → pending_signature. Calls the Flowmono STUB. */
export async function sendAgreement(formData: FormData): Promise<void> {
  const landlordId = String(formData.get("landlordId") ?? "");
  if (!isUuid(landlordId)) redirect("/admin/landlords?error=Invalid+landlord");

  let error: string | null = null;
  let msg: string | null = null;
  try {
    await assertAdminAction();
    const admin = createAdminClient();
    const { data: landlord } = await admin
      .from("landlords")
      .select("id, status, agreement_status")
      .eq("id", landlordId)
      .maybeSingle();
    if (!landlord) throw new Error("Landlord not found.");
    if (landlord.status !== "kyc_verified") throw new Error("Landlord must be verified before the agreement is sent.");
    if (landlord.agreement_status !== "not_sent") throw new Error("Agreement has already been sent.");

    const [{ data: profile }, { data: userRes }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", landlordId).maybeSingle(),
      admin.auth.admin.getUserById(landlordId),
    ]);
    const sent = await sendAgreementForSigning({
      landlordId,
      landlordName: profile?.full_name ?? null,
      email: userRes.user?.email ?? null,
    });
    if (!sent.ok) throw new Error(sent.error);

    const { error: dbErr } = await admin
      .from("landlords")
      .update({ agreement_status: "pending_signature" })
      .eq("id", landlordId)
      .eq("agreement_status", "not_sent");
    if (dbErr) throw new Error(dbErr.message);

    await notifyLandlord({
      landlordId,
      event: "agreement_sent",
      subject: "Your HomeLy management agreement is ready to sign",
      message: "We have sent your management agreement for e-signature. Once it is signed we schedule the inspection.",
    });
    revalidate(landlordId);
    msg = "Agreement marked as sent (Flowmono stub — no real document was sent).";
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(landlordId, error ? { error } : { msg: msg ?? undefined });
}

/** INTERIM: pending_signature → signed by hand. TODO(flowmono): replaced by the signed webhook. */
export async function markAgreementSigned(formData: FormData): Promise<void> {
  const landlordId = String(formData.get("landlordId") ?? "");
  if (!isUuid(landlordId)) redirect("/admin/landlords?error=Invalid+landlord");

  let error: string | null = null;
  let msg: string | null = null;
  try {
    await assertAdminAction();
    const admin = createAdminClient();
    const { data, error: dbErr } = await admin
      .from("landlords")
      .update({ agreement_status: "signed" })
      .eq("id", landlordId)
      .eq("agreement_status", "pending_signature")
      .select("id")
      .maybeSingle();
    if (dbErr) throw new Error(dbErr.message);
    if (!data) throw new Error("Agreement is not awaiting signature.");

    await notifyLandlord({
      landlordId,
      event: "agreement_signed",
      subject: "Agreement signed — inspection next",
      message: "Your management agreement is signed. Our Enugu team will contact you to schedule the inspection.",
    });
    revalidate(landlordId);
    msg = "Agreement marked signed (manual interim step).";
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  back(landlordId, error ? { error } : { msg: msg ?? undefined });
}
