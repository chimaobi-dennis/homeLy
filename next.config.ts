import type { NextConfig } from "next";

/**
 * Photos are served as signed URLs from Supabase Storage. The host differs
 * between the local stack and the cloud project, so it is derived from
 * NEXT_PUBLIC_SUPABASE_URL at config time instead of being hardcoded.
 */
function supabaseImagePattern(pathname = "/storage/v1/object/sign/**") {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const url = new URL(raw);
  return {
    protocol: url.protocol.replace(":", "") as "http" | "https",
    hostname: url.hostname,
    port: url.port || undefined,
    pathname,
  };
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
}

const nextConfig: NextConfig = {
  logging: {
    // Server Function calls are logged WITH their arguments in dev by default,
    // which would print sign-up passwords to the terminal. Keep this off.
    serverFunctions: false,
  },
  images: {
    // 60 for the big decorative photos under a dark overlay (hero, banner); 75 for listing photos.
    qualities: [60, 75],
    // Signed URLs (private buckets: listing photos) + public URLs (site-media: homepage images).
    remotePatterns: [supabaseImagePattern(), supabaseImagePattern("/storage/v1/object/public/**")],
    // Next refuses to optimize images from hosts that resolve to private/loopback
    // IPs (SSRF protection). The LOCAL Supabase stack lives at 127.0.0.1, so allow
    // it there only; the cloud project's public hostname needs no exception.
    dangerouslyAllowLocalIP: isLocalHost(supabaseImagePattern().hostname),
  },
};

export default nextConfig;
