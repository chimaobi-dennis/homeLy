import "server-only";

/**
 * Tenant identity verification — STUB (same pattern as agreements/flowmono.ts).
 *
 * TODO(dojah): this is exactly where the Dojah API call goes.
 *   1. Send the uploaded ID document (and, later, a selfie / BVN / NIN lookup)
 *      to Dojah for automated verification.
 *   2. Map Dojah's decision to tenants.kyc_status (verified / rejected with a
 *      reason) — via the service role, never from the client.
 *   3. Persist Dojah's reference id on `tenants` (needs a migration) for audit.
 *
 * The real API shape has NOT been looked at yet — do not guess it. Until it is
 * integrated, every submission is returned as `manual_review` and an admin
 * decides on /admin/tenants, exactly like landlord KYC.
 */
export type VerifyTenantKycInput = {
  tenantId: string;
  documentPaths: string[];
};

export type VerifyTenantKycResult =
  | { ok: true; provider: "stub"; decision: "manual_review"; reference: null }
  | { ok: false; error: string };

export async function verifyTenantKyc(input: VerifyTenantKycInput): Promise<VerifyTenantKycResult> {
  console.info(
    `[dojah STUB] would verify ${input.documentPaths.length} document(s) for tenant ${input.tenantId}. ` +
      "No API call made — routed to manual review. TODO(dojah).",
  );
  return { ok: true, provider: "stub", decision: "manual_review", reference: null };
}
