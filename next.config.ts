import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  // A separate test dev server must not share .next/dev locks with the author's app.
  ...(process.env.REPROBOARD_TEST_RUN ? { distDir: ".next/integration", typescript: { tsconfigPath: "tsconfig.integration.json" } } : {}),
};

export default nextConfig;
