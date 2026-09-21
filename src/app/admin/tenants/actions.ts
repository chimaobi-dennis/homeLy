"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdminAction } from "@/lib/auth";
import { notifyTenant } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid, optionalText } from "@/lib/validation";

/**
 * Tenant KYC decisions — same pattern as setLandlordKyc: re-read the caller's
 * admin role from the DB, then write the protected columns with the service
 * role scoped to the exact row, notify the tenant (stub), redirect back.
 * TODO(dojah): automated verification would land here via a webhook instead.
 */
export async function setTenantKyc(formData: FormData): Promise<void> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/admin/tenants");
  const base = returnTo.startsWith("/admin/tenants") ? returnTo.split("?")[0] : "/admin/tenants";
  const keep = returnTo.includes("status=") ? `status=${new URLSearchParams(returnTo.split("?")[1] ?? "").get("status") ?? ""}&` : "";

  let error: string | null = null;
  let msg: string | null = null;
  try {
    await assertAdminAction();
    if (!isUuid(tenantId)) throw new Error("Invalid tenant.");
    const decision = String(formData.get("decision") ?? "");
    const reason = optionalText(formData.get("reason"), 2000);
    if (decision !== "verified" && decision !== "rejected") throw new Error("Choose verified or rejected.");
    if (decision === "rejected" && !reason) throw new Error("A reason is required when rejecting — the tenant will see it.");

    const service = createAdminClient();
    const { data, error: dbErr } = await service
      .from("tenants")
      .update({ kyc_status: decision, kyc_rejection_reason: decision === "rejected" ? reason : null })
      .eq("id", tenantId)
      .select("id, waitlist_entry_id")
      .maybeSingle();
    if (dbErr) throw new Error(dbErr.message);
    if (!data) throw new Error("Tenant not found.");

    // Mirror into the waitlist stage. Rejected stays 'kyc_pending' (still in the KYC process).
    if (data.waitlist_entry_id) {
      await service
        .from("waitlist_entries")
        .update({ conversion_status: decision === "verified" ? "active_queue" : "kyc_pending" })
        .eq("id", data.waitlist_entry_id);
    }

    await notifyTenant({
      tenantId,
      event: decision === "verified" ? "tenant_kyc_verified" : "tenant_kyc_rejected",
      subject: decision === "verified" ? "You're verified — you're in the HomeLy queue" : "We could not confirm your ID yet",
      message:
        decision === "verified"
          ? "Your identity is confirmed and you are now an active member of the queue. When homes become available we contact you in queue order. Nothing else is needed from you now."
          : `We could not confirm your identity from the document provided.\n\nReason: ${reason}\n\nUpload a clearer document on your status page and resubmit.`,
    });
    revalidatePath("/admin/tenants");
    revalidatePath("/admin/waitlist");
    revalidatePath("/tenant");
    msg = decision === "verified" ? "Tenant verified — now an active queue member." : "Tenant marked rejected; reason saved.";
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }
  const q = error ? `error=${encodeURIComponent(error)}` : `msg=${encodeURIComponent(msg ?? "")}`;
  redirect(`${base}?${keep}${q}`);
}
