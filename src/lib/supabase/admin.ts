import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseUrl } from "./env";

/**
 * Service-role client. BYPASSES ROW-LEVEL SECURITY.
 *
 * Only for trusted server-side code that must act outside a user's own rows:
 *   - creating staff/admin accounts with app_metadata.role_tags
 *   - resolving a staff invite token for the public /staff/invite/[token] page
 *   - moving landlord / property status and waitlist confirmation flags
 *     (TODO(dojah) / TODO(termii) / TODO(resend) webhook handlers)
 *
 * Never import this from a Client Component. `server-only` makes that a build error.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing environment variable SUPABASE_SECRET_KEY (server-only).");
  }

  return createSupabaseClient<Database>(getSupabaseUrl(), secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
