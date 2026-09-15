import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase Auth session on every request and writes any rotated
 * tokens back to the response cookies. Server Components cannot set cookies,
 * so without this step sessions would silently expire.
 *
 * No route protection yet — there are no protected pages in this session.
 * Admin / staff / landlord route guards will be added here in a later session.
 * Tenants never have a session (the waitlist is anonymous), so nothing here
 * applies to /waitlist beyond being a no-op.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Triggers lazy session initialisation and, if needed, a token refresh.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
