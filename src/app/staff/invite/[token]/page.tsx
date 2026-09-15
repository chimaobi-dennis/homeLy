import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { getSessionProfile } from "@/lib/auth";
import { inviteState, isInviteToken, type InviteState } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { AcceptInviteForm } from "./accept-form";

export const metadata: Metadata = { title: "Staff invite · HomeLy" };

/**
 * Public invite landing. staff_invites is admin-only under RLS, so the token is
 * resolved server-side with the service role, scoped to this exact token.
 * Three clearly distinct non-valid states are shown; none of them render a form.
 */
export default async function StaffInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSessionProfile();

  let invite: { id: string; email: string; role_tags: string[]; status: "pending" | "accepted" | "revoked" | "expired"; expires_at: string } | null = null;
  if (isInviteToken(token)) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("staff_invites")
      .select("id, email, role_tags, status, expires_at")
      .eq("token", token)
      .maybeSingle();
    invite = data;

    // Lazily record expiry so the admin list reflects it too.
    if (invite && invite.status === "pending" && inviteState(invite) === "expired") {
      await admin.from("staff_invites").update({ status: "expired" }).eq("id", invite.id).eq("status", "pending");
      invite = { ...invite, status: "expired" };
    }
  }

  const state: InviteState | "not_found" = invite ? inviteState(invite) : "not_found";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">HomeLy staff</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {state === "valid" ? "Set up your staff account" : "Staff invitation"}
        </h1>
      </div>

      {session ? (
        <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          You are currently signed in as {session.email}. Sign out first if you are accepting this invite for a
          different account.
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      ) : null}

      {state === "valid" && invite ? (
        <AcceptInviteForm token={token} email={invite.email} roleTags={invite.role_tags} />
      ) : null}

      {state === "accepted" ? (
        <StateBox title="This invite has already been used">
          The account for {invite?.email} was already set up.{" "}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>{" "}
          with your password, or ask an admin if that was not you.
        </StateBox>
      ) : null}

      {state === "revoked" ? (
        <StateBox title="This invite was revoked">
          An admin withdrew this invitation, so the link no longer works. If you think that is a mistake, ask them for
          a new one.
        </StateBox>
      ) : null}

      {state === "expired" ? (
        <StateBox title="This invite has expired">
          Invite links are valid for a limited time and this one has passed its expiry
          {invite ? ` (${new Date(invite.expires_at).toLocaleString("en-NG")})` : ""}. Ask an admin to send a new
          one.
        </StateBox>
      ) : null}

      {state === "not_found" ? (
        <StateBox title="This invite link is not valid">
          The link is incomplete or does not match any invitation. Check that you copied the whole link, or ask an
          admin for a new one.
        </StateBox>
      ) : null}
    </main>
  );
}

function StateBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-300 p-4 dark:border-zinc-700">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{children}</p>
    </div>
  );
}
