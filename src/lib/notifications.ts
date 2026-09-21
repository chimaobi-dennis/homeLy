import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type LandlordNotificationEvent =
  | "application_submitted"
  | "kyc_verified"
  | "kyc_rejected"
  | "property_status_changed"
  | "agreement_sent"
  | "agreement_signed";

export type StaffNotificationEvent = "staff_invite" | "staff_account_ready";

export type TenantNotificationEvent =
  | "tenant_conversion_invite"
  | "tenant_account_ready"
  | "tenant_kyc_submitted"
  | "tenant_kyc_verified"
  | "tenant_kyc_rejected";

export type NotificationEvent = LandlordNotificationEvent | StaffNotificationEvent | TenantNotificationEvent;

export type NotifyByEmailInput = {
  /** Recipient address. May be null when it could not be resolved — still logged. */
  to: string | null;
  event: NotificationEvent;
  subject: string;
  /** Plain-text body. Keep it short and specific. */
  message: string;
  /** Free-text context for the log line, e.g. "landlord <uuid>" or "invite <uuid>". */
  context?: string;
};

/**
 * The ONE outbound-email path. Every notification (landlord status changes,
 * staff invites, ...) goes through here.
 *
 * - If RESEND_API_KEY is NOT set: the notification is written to the server
 *   console with an unmissable [notify STUB] prefix. Nothing is sent.
 * - If RESEND_API_KEY IS set: real sending is NOT implemented yet. We still
 *   log, loudly, so nothing is skipped silently.
 *   TODO(resend): call the Resend API here.
 *
 * Never throws — a failed notification must never break the action that
 * triggered it.
 */
export async function notifyByEmail(input: NotifyByEmailInput): Promise<void> {
  const lines = [
    "==================== [notify STUB] ====================",
    `event:   ${input.event}`,
    `to:      ${input.to ?? "(unknown email)"}${input.context ? `  (${input.context})` : ""}`,
    `subject: ${input.subject}`,
    "---",
    input.message,
    "=======================================================",
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

export type NotifyLandlordInput = {
  landlordId: string;
  event: LandlordNotificationEvent;
  subject: string;
  message: string;
};

/** Landlord-facing "your status changed" notifications. Resolves the email, then uses notifyByEmail. */
export async function notifyLandlord(input: NotifyLandlordInput): Promise<void> {
  let email: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(input.landlordId);
    email = data.user?.email ?? null;
  } catch (err) {
    console.error("[notifyLandlord] could not resolve landlord email:", err);
  }
  await notifyByEmail({
    to: email,
    event: input.event,
    subject: input.subject,
    message: input.message,
    context: `landlord ${input.landlordId}`,
  });
}

export type NotifyTenantInput = {
  tenantId: string;
  event: TenantNotificationEvent;
  subject: string;
  message: string;
};

/** Tenant-facing notifications (Stage 2). Resolves the email, then uses notifyByEmail. */
export async function notifyTenant(input: NotifyTenantInput): Promise<void> {
  let email: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(input.tenantId);
    email = data.user?.email ?? null;
  } catch (err) {
    console.error("[notifyTenant] could not resolve tenant email:", err);
  }
  await notifyByEmail({
    to: email,
    event: input.event,
    subject: input.subject,
    message: input.message,
    context: `tenant ${input.tenantId}`,
  });
}
