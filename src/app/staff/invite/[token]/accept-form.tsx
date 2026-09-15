"use client";

import { useActionState } from "react";
import { acceptStaffInvite, type AcceptInviteState } from "./actions";

const input = "w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

const STATE_TITLE = {
  accepted: "This invite has already been used",
  revoked: "This invite was revoked",
  expired: "This invite has expired",
} as const;

export function AcceptInviteForm({ token, email, roleTags }: { token: string; email: string; roleTags: string[] }) {
  const [state, action, pending] = useActionState<AcceptInviteState, FormData>(acceptStaffInvite, { error: null });

  // The token stopped being valid between page load and submit — show the state, not a form.
  if (state.inviteState) {
    return (
      <div className="rounded-md border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="font-semibold">{STATE_TITLE[state.inviteState]}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{state.error}</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
        <div>
          <span className="text-zinc-500">Email: </span>
          {email}
        </div>
        <div>
          <span className="text-zinc-500">Role{roleTags.length > 1 ? "s" : ""}: </span>
          {roleTags.join(" + ")}
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Your full name</span>
        <input name="fullName" required maxLength={120} autoComplete="name" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Choose a password</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} />
        <span className="text-xs text-zinc-500">At least 8 characters.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Confirm password</span>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={input} />
      </label>
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? "Creating your account…" : "Set password and sign in"}
      </button>
    </form>
  );
}
