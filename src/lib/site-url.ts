import "server-only";

import { headers } from "next/headers";

/**
 * Absolute origin for links we hand out (invite URLs). Prefers
 * NEXT_PUBLIC_SITE_URL; otherwise derives it from the incoming request.
 */
export async function getSiteUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}
