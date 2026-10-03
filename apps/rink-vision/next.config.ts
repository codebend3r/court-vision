import { resolve } from "node:path";

import type { NextConfig } from "next";

// The monorepo root: Turbopack compiles only files under its root, and the
// workspace libs live beside this app. File tracing must agree with it.
const workspaceRoot = resolve(import.meta.dirname, "../..");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  // Workspace libs ship TypeScript source, not a build, so Next compiles them.
  transpilePackages: ["@vision/core", "@vision/sport-hockey", "@vision/ui"],
  // `next dev` otherwise writes its own AGENTS.md/CLAUDE.md here whenever an
  // AI agent starts it; the repo's root CLAUDE.md covers this app.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
