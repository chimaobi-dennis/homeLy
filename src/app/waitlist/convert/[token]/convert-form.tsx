"use client";

import { useActionState } from "react";
import { acceptConversionInvite, attachConversionInviteToSession, type ConvertState } from "./actions";

const input = "w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
const primary = "rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60";

const STATE_TITLE = {
  accepted: "This invite has already been used",
  revoked: "This invite was withdrawn",
  expired: "This invite has expired",
} as const;

function StateBox({ state, message }: { state: keyof typeof STATE_TITLE; message: string | null }) {
  return (
    <div className="rounded-md border border-zinc-300 p-4 dark:border-zinc-700">
      <h2 className="font-semibold">{STATE_TITLE[state]}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
    </div>
  );
}

export function ConvertForm({ token, email, name }: { token: string; email: string; name: string }) {
  const [state, action, pending] = useActionState<ConvertState, FormData>(acceptConversionInvite, { error: null });
  if (state.inviteState) return <StateBox state={state.inviteState} message={state.error} />;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
        <span className="text-zinc-500">Account email: </span>
        {email}
        <p className="mt-1 text-xs text-zinc-500">This is the email you joined the priority list with. It cannot be changed here.</p>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Your full name</span>
        <input name="fullName" required maxLength={120} defaultValue={name} autoComplete="name" className={input} />
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
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Creating your account…" : "Create my account"}
      </button>
      <p className="text-xs text-zinc-500">Next step after this: upload a government-issued ID for a person on our team to check.</p>
    </form>
  );
}

export function AttachForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<ConvertState, FormData>(attachConversionInviteToSession, { error: null });
  if (state.inviteState) return <StateBox state={state.inviteState} message={state.error} />;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm">
        You are signed in as <strong>{email}</strong>, which matches this invite. Continue with this account — we add the queue
        membership to it, no second account needed.
      </p>
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={primary + " self-start"}>
        {pending ? "One moment…" : "Continue with this account"}
      </button>
    </form>
  );
}
