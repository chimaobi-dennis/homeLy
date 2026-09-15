"use client";

import { useActionState } from "react";
import { joinWaitlist, type JoinWaitlistState } from "./actions";

const input = "w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

export function WaitlistForm() {
  const [state, action, pending] = useActionState<JoinWaitlistState, FormData>(joinWaitlist, {
    error: null,
    values: { name: "", whatsapp: "", email: "" },
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input name="company" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Your name</span>
        <input name="name" required maxLength={120} defaultValue={state.values.name} autoComplete="name" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">WhatsApp number</span>
        <input
          name="whatsapp"
          type="tel"
          required
          defaultValue={state.values.whatsapp}
          autoComplete="tel"
          placeholder="+234…"
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input name="email" type="email" required defaultValue={state.values.email} autoComplete="email" className={input} />
      </label>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? "Adding you…" : "Put me on the list"}
      </button>
      <p className="text-xs text-zinc-500">
        We only use these details to contact you about HomeLy homes. No account is created and nothing is shared.
      </p>
    </form>
  );
}
