/**
 * Supabase connection settings.
 *
 * `process.env.NEXT_PUBLIC_*` must be referenced literally so Next.js can inline
 * the values into client bundles.
 *
 * Values for the local stack come from `supabase status`; see `.env.example`.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it from \`supabase status\`.`,
    );
  }
  return value;
}

export function getSupabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** Publishable (a.k.a. anon) key — safe to ship to the browser; RLS does the gatekeeping. */
export function getSupabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
