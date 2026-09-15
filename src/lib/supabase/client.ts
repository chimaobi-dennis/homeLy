"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Supabase client for Client Components (browser).
 * Sessions are stored in cookies so Server Components and the proxy see the
 * same session. Safe to call repeatedly — @supabase/ssr returns a singleton.
 */
export function createClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabasePublishableKey());
}
