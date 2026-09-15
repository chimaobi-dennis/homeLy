/**
 * HomeLy role model.
 *
 * Three kinds of real auth account:
 *   - admin     — the platform owner
 *   - staff     — `bd` and/or `inspector`; ONE account may hold both tags
 *   - landlord  — property owners (self-service sign-up)
 *
 * Tenants have NO auth account at this stage: the waitlist is anonymous.
 * Mirrors the `profiles.role_tags` check constraint in the database.
 */
export const ROLE_TAGS = ["admin", "bd", "inspector", "landlord"] as const;
export type RoleTag = (typeof ROLE_TAGS)[number];

export const STAFF_ROLE_TAGS = ["bd", "inspector"] as const satisfies readonly RoleTag[];
export type StaffRoleTag = (typeof STAFF_ROLE_TAGS)[number];

export function isRoleTag(value: unknown): value is RoleTag {
  return typeof value === "string" && (ROLE_TAGS as readonly string[]).includes(value);
}

export function hasRole(roleTags: readonly string[] | null | undefined, tag: RoleTag): boolean {
  return roleTags?.includes(tag) ?? false;
}

export function isAdmin(roleTags: readonly string[] | null | undefined): boolean {
  return hasRole(roleTags, "admin");
}

/** bd, inspector or admin — mirrors public.is_staff_or_admin() in Postgres. */
export function isStaffOrAdmin(roleTags: readonly string[] | null | undefined): boolean {
  return isAdmin(roleTags) || hasRole(roleTags, "bd") || hasRole(roleTags, "inspector");
}
