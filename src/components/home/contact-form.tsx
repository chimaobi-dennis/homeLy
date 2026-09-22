"use client";

import { useActionState } from "react";
import { sendContactMessage, type ContactState } from "@/app/contact/actions";

const input = "min-h-11 w-full rounded-[var(--radius)] border border-[var(--rule)] bg-white px-3 py-2 text-[var(--ink)]";

/**
 * Contact form. `defaultMessage` pre-fills the message (the property page uses
 * it for "Request a viewing"); `compact` drops the visible labels for the
 * sidebar layout (placeholders + aria-labels instead).
 */
export function ContactForm({
  defaultMessage,
  submitLabel = "Send message",
  compact = false,
}: {
  defaultMessage?: string;
  submitLabel?: string;
  compact?: boolean;
} = {}) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactMessage, { ok: false, error: null });

  if (state.ok) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-white p-5">
        <p className="font-semibold">Message received.</p>
        <p className="mt-1 text-sm text-[var(--mute)]">A person on the team will reply on WhatsApp.</p>
      </div>
    );
  }

  const labelClass = compact ? "sr-only" : "font-medium";

  return (
    <form action={action} className="flex flex-col gap-3">
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input name="company" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className={labelClass}>Your name</span>
        <input name="name" required maxLength={120} autoComplete="name" placeholder={compact ? "Your name" : undefined} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className={labelClass}>WhatsApp number</span>
        <input name="whatsapp" type="tel" required autoComplete="tel" placeholder={compact ? "WhatsApp number (+234…)" : "+234…"} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className={labelClass}>Message</span>
        <textarea name="message" required maxLength={2000} rows={4} defaultValue={defaultMessage} placeholder={compact ? "Message" : undefined} className={input} />
      </label>
      {state.error ? (
        <p role="alert" className="rounded-[var(--radius)] bg-white px-3 py-2 text-sm text-[var(--clay)]">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="pill pill--verify self-start disabled:opacity-60">
        {pending ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
