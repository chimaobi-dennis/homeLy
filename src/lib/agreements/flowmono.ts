import "server-only";

/**
 * Management-agreement e-signature — STUB.
 *
 * TODO(flowmono): this is exactly where the Flowmono API call goes.
 *   1. Create/prepare the agreement document for the landlord (name, property,
 *      agreed management fee %, maintenance threshold).
 *   2. Call Flowmono to create a signing request and send it to `email`.
 *   3. Persist Flowmono's request/document id on `landlords` (needs a migration)
 *      so the signed-webhook can flip agreement_status → 'signed'.
 *
 * The real API shape has NOT been looked at yet — do not guess it. Until it is
 * integrated, admin flips pending_signature → signed manually from
 * /admin/landlords/[id] as an interim substitute.
 */
export type SendAgreementInput = {
  landlordId: string;
  landlordName: string | null;
  email: string | null;
};

export type SendAgreementResult =
  | { ok: true; provider: "stub"; reference: null }
  | { ok: false; error: string };

export async function sendAgreementForSigning(
  input: SendAgreementInput,
): Promise<SendAgreementResult> {
  console.info(
    `[flowmono STUB] would send management agreement to ${input.email ?? "(no email)"} ` +
      `for landlord ${input.landlordId} (${input.landlordName ?? "unnamed"}). ` +
      "No API call made — TODO(flowmono).",
  );
  return { ok: true, provider: "stub", reference: null };
}
