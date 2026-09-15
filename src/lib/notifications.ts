import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type LandlordNotificationEvent =
  | "application_submitted"
  | "kyc_verified"
  | "kyc_rejected"
  | "property_status_changed"
  | "agreement_sent"
  | "agreement_signed";

export type NotifyLandlordInput = {
  landlordId: string;
  event: LandlordNotificationEvent;
  subject: string;
  /** Plain-text body. Keep it short and specific. */
  message: string;
};

/**
 * Every landlord-facing "your status changed" notification goes through here.
 *
 * - If RESEND_API_KEY is NOT set: the notification is written to the server
 *   console with an unmissable [notifyLandlord STUB] prefix. Nothing is sent.
 * - If RESEND_API_KEY IS set: real sending is NOT implemented yet (out of scope
 *   for Step 2). We still log, loudly, so nothing is skipped silently.
 *   TODO(resend): call the Resend API here.
 *
 * Never throws — a failed notification must never break a status change.
 */
export async function notifyLandlord(input: NotifyLandlordInput): Promise<void> {
  let email: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(input.landlordId);
    email = data.user?.email ?? null;
  } catch (err) {
    console.error("[notifyLandlord] could not resolve landlord email:", err);
  }

  const lines = [
    "==================== [notifyLandlord STUB] ====================",
    `event:   ${input.event}`,
    `to:      ${email ?? "(unknown email)"}  (landlord ${input.landlordId})`,
    `subject: ${input.subject}`,
    "---",
    input.message,
    "==============================================================",
  ];

  if (!process.env.RESEND_API_KEY) {
    console.info(["RESEND_API_KEY not set — logging instead of sending.", ...lines].join("\n"));
    return;
  }

  // TODO(resend): send via Resend. Until then, make it obvious we did NOT send.
  console.warn(
    ["RESEND_API_KEY is set but Resend sending is not implemented yet — NOT sent.", ...lines].join("\n"),
  );
}
