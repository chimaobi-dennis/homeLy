/** Tiny validation helpers for server actions. Return a message string on failure. */

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export function requiredText(value: unknown, label: string, max = 200): string | { error: string } {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return { error: `${label} is required.` };
  if (s.length > max) return { error: `${label} must be ${max} characters or fewer.` };
  return s;
}

export function optionalText(value: unknown, max = 200): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s.slice(0, max) : null;
}

export function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export function isPhone(value: string): boolean {
  return /^\+?[0-9][0-9 ()-]{5,19}$/.test(value);
}

export function toInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[,\s]/g, ""));
  return Number.isInteger(n) ? n : null;
}

export function toMoney(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[₦,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Only allow same-origin relative paths for post-login redirects. */
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
