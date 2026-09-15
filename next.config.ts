import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    // Server Function calls are logged WITH their arguments in dev by default,
    // which would print sign-up passwords to the terminal. Keep this off.
    serverFunctions: false,
  },
};

export default nextConfig;
