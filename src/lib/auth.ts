import "server-only";

import { notFound, redirect } from "next/navigation";
import { isAdmin, isStaffOrAdmin, hasRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type SessionProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  roleTags: string[];
};

/**
 * The signed-in user plus their profile, read through the user's OWN session
 * (so RLS applies). Returns null when nobody is signed in.
 * role_tags always come from the database — never from anything the client sends.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role_tags")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    roleTags: profile?.role_tags ?? [],
  };
}

/** For pages: redirect to /login when signed out. */
export async function requireSession(nextPath: string): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return profile;
}

/** For pages under /admin: signed-out → login; signed-in non-admin → 404 (admin area is not advertised). */
export async function requireAdminPage(nextPath = "/admin/landlords"): Promise<SessionProfile> {
  const profile = await requireSession(nextPath);
  if (!isAdmin(profile.roleTags)) notFound();
  return profile;
}

/** For pages under /admin that staff (bd / inspector) may also use: signed-out → login; other roles → 404. */
export async function requireStaffOrAdminPage(nextPath = "/admin"): Promise<SessionProfile> {
  const profile = await requireSession(nextPath);
  if (!isStaffOrAdmin(profile.roleTags)) notFound();
  return profile;
}

/** For server actions: throws instead of redirecting. The caller's role is re-read from the DB every call. */
export async function assertAdminAction(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) throw new Error("Not signed in.");
  if (!isAdmin(profile.roleTags)) throw new Error("Not authorised: admin role required.");
  return profile;
}

/** For server actions that staff (bd / inspector) may run as well as admin — e.g. listing content. */
export async function assertStaffOrAdminAction(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) throw new Error("Not signed in.");
  if (!isStaffOrAdmin(profile.roleTags)) throw new Error("Not authorised: staff or admin role required.");
  return profile;
}

/** For server actions on the landlord side. */
export async function assertLandlordAction(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) throw new Error("Not signed in.");
  if (!hasRole(profile.roleTags, "landlord")) throw new Error("This account is not a landlord account.");
  return profile;
}

/** Where a signed-in user lands by default. */
export function homePathFor(roleTags: readonly string[]): string {
  if (isAdmin(roleTags)) return "/admin/landlords";
  if (hasRole(roleTags, "landlord")) return "/landlord/dashboard";
  if (isStaffOrAdmin(roleTags)) return "/admin/waitlist";
  if (hasRole(roleTags, "tenant")) return "/tenant";
  return "/";
}

/** For server actions on the tenant side (Stage 2 accounts). */
export async function assertTenantAction(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) throw new Error("Not signed in.");
  if (!hasRole(profile.roleTags, "tenant")) throw new Error("This account is not a tenant account.");
  return profile;
}
