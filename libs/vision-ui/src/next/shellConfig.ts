import { resolve } from "node:path";

import type { NextConfig } from "next";

import { SECURITY_HEADERS } from "#ui/next/securityHeaders";

// The next.config a *-vision shell app (one with no data source, database or
// auth yet) exports: the app's own dir, and the sport lib it renders on top of
// the shared core and design system.
type ShellNextConfigProps = { appDir: string; sportPackage: string };

export const shellNextConfig = ({ appDir, sportPackage }: ShellNextConfigProps): NextConfig => {
  // The monorepo root: Turbopack compiles only files under its root, and the
  // workspace libs live beside the app. File tracing must agree with it.
  const workspaceRoot = resolve(appDir, "../..");
  return {
    turbopack: { root: workspaceRoot },
    outputFileTracingRoot: workspaceRoot,
    // Workspace libs ship TypeScript source, not a build, so Next compiles them.
    transpilePackages: ["@vision/core", sportPackage, "@vision/ui"],
    // `next dev` otherwise writes its own AGENTS.md/CLAUDE.md into the app
    // whenever an AI agent starts it; the repo's root CLAUDE.md covers it.
    agentRules: false,
    async headers() {
      return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
    },
  };
};
