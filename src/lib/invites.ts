import type { Database } from "@/lib/supabase/database.types";

export type StaffInviteStatus = Database["public"]["Enums"]["staff_invite_status"];

/**
 * ASSUMPTION (Step 4): invites expire 7 days after creation. Not specified by
 * the owner — change this constant (and the DB default in migration 0005 if
 * you want them aligned) to use a different window.
 */
export const INVITE_EXPIRY_DAYS = 7;

/** Tokens are 32 random bytes hex-encoded by the DB default (migration 0005). */
const TOKEN_RE = /^[0-9a-f]{64}$/;

export function isInviteToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

/** What a visitor of the invite link should see. Three distinct non-valid states, never collapsed. */
export type InviteState = "valid" | "accepted" | "revoked" | "expired";

export function inviteState(
  invite: { status: StaffInviteStatus; expires_at: string },
  nowMs: number = Date.now(),
): InviteState {
  if (invite.status === "accepted") return "accepted";
  if (invite.status === "revoked") return "revoked";
  if (invite.status === "expired") return "expired";
  if (new Date(invite.expires_at).getTime() <= nowMs) return "expired";
  return "valid";
}

export const INVITE_STATE_LABEL: Record<InviteState, string> = {
  valid: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

export function invitePath(token: string): string {
  return `/staff/invite/${token}`;
}
