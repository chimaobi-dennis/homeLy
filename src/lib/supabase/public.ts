import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Anonymous, cookie-less client for PUBLIC data only (the `public_listings` /
 * `public_listing_photos` views and the contact RPC). It never carries a
 * session, so pages that use it can be statically cached (ISR) and behave
 * identically for every visitor. Anything a signed-in user should see goes
 * through `server.ts` instead.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
