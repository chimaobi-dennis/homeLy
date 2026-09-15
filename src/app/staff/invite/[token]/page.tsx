import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Staff invite · HomeLy" };

// TODO(session 2+): resolve `token` against `staff_invites` SERVER-SIDE (the
// table is admin-only under RLS), then let the invitee set a password. The
// resulting auth user is created with app_metadata.role_tags from the invite.
export default async function StaffInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <ComingSoon
      title="Staff invitation"
      route={`/staff/invite/${token}`}
      description="Invited BD and inspection staff will accept their invitation and set a password here."
    />
  );
}
