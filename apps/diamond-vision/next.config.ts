import { resolve } from "node:path";

import type { NextConfig } from "next";

import { SECURITY_HEADERS } from "@vision/ui/next/securityHeaders";

// The monorepo root: Turbopack compiles only files under its root, and the
// workspace libs live beside this app. File tracing must agree with it.
const workspaceRoot = resolve(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  // Workspace libs ship TypeScript source, not a build, so Next compiles them.
  transpilePackages: ["@vision/core", "@vision/sport-baseball", "@vision/ui"],
  // `next dev` otherwise writes its own AGENTS.md/CLAUDE.md here whenever an
  // AI agent starts it; the repo's root CLAUDE.md covers this app.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
  },
};

export default nextConfig;
