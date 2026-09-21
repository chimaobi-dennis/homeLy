import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { getSessionProfile } from "@/lib/auth";
import { inviteState, isInviteToken, type InviteState } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { AttachForm, ConvertForm } from "./convert-form";

export const metadata: Metadata = { title: "Create your HomeLy account · HomeLy" };

/**
 * Public conversion landing (Stage 2). queue_conversion_invites is admin-only
 * under RLS, so the token is resolved server-side with the service role,
 * scoped to this exact token. Same three-state pattern as staff invites.
 */
export default async function ConvertInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSessionProfile();

  let invite: { id: string; waitlist_entry_id: string; status: "pending" | "accepted" | "revoked" | "expired"; expires_at: string } | null = null;
  let entry: { name: string; email: string } | null = null;

  if (isInviteToken(token)) {
    const admin = createAdminClient();
    const { data } = await admin.from("queue_conversion_invites").select("id, waitlist_entry_id, status, expires_at").eq("token", token).maybeSingle();
    invite = data;
    if (invite) {
      if (invite.status === "pending" && inviteState(invite) === "expired") {
        await admin.from("queue_conversion_invites").update({ status: "expired" }).eq("id", invite.id).eq("status", "pending");
        invite = { ...invite, status: "expired" };
        // Not converted → back to plain 'waitlist' so the entry can be re-invited (same as revoke).
        const { data: tenant } = await admin.from("tenants").select("id").eq("waitlist_entry_id", invite.waitlist_entry_id).maybeSingle();
        if (!tenant) {
          await admin.from("waitlist_entries").update({ conversion_status: "waitlist" }).eq("id", invite.waitlist_entry_id).eq("conversion_status", "invited_to_convert");
        }
      }
      const { data: e } = await admin.from("waitlist_entries").select("name, email").eq("id", invite.waitlist_entry_id).maybeSingle();
      entry = e;
    }
  }

  const state: InviteState | "not_found" = invite && entry ? inviteState(invite) : "not_found";
  const sessionMatches = Boolean(session && entry && (session.email ?? "").toLowerCase() === entry.email.toLowerCase());

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">HomeLy · priority list</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {state === "valid" ? "Keep your place: create your account" : "Priority list invitation"}
        </h1>
        {state === "valid" ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            The official queue is opening. Your place is kept in the order you joined. Create your account, then upload an ID
            so a person on our team can confirm who you are. There are still no live listings — this step only confirms
            you.
          </p>
        ) : null}
      </div>

      {session && !sessionMatches ? (
        <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          You are signed in as {session.email}. Sign out first if this invite is for a different email.
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      ) : null}

      {state === "valid" && entry ? (
        sessionMatches ? <AttachForm token={token} email={entry.email} /> : <ConvertForm token={token} email={entry.email} name={entry.name} />
      ) : null}

      {state === "accepted" ? (
        <StateBox title="This invite has already been used">
          The account for {entry?.email} was already set up.{" "}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>{" "}
          to see your status, or contact HomeLy if that was not you.
        </StateBox>
      ) : null}
      {state === "revoked" ? (
        <StateBox title="This invite was withdrawn">
          HomeLy withdrew this invitation, so the link no longer works. Your place on the priority list is unchanged. If
          you think this is a mistake, reply to the message that brought you here.
        </StateBox>
      ) : null}
      {state === "expired" ? (
        <StateBox title="This invite has expired">
          Invite links are valid for a limited time and this one has passed its expiry
          {invite ? ` (${new Date(invite.expires_at).toLocaleString("en-NG")})` : ""}. Your place on the priority list is
          unchanged — contact HomeLy for a new link.
        </StateBox>
      ) : null}
      {state === "not_found" ? (
        <StateBox title="This invite link is not valid">
          The link is incomplete or does not match any invitation. Check that you copied the whole link, or contact HomeLy.
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
