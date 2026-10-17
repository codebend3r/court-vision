import { resolve } from "node:path";

import type { NextConfig } from "next";

import { SECURITY_HEADERS } from "@vision/ui/next/securityHeaders";

import packageJson from "./package.json";

// The monorepo root. Turbopack only compiles files under its root, and the
// workspace libs (libs/*) live beside this app, not inside it; file tracing
// must agree with Turbopack or Next warns and picks one itself.
const workspaceRoot = resolve(import.meta.dirname, "../..");

// Workspace libs ship TypeScript source, not a build, so Next compiles them.
const workspacePackages = [
  "@vision/core",
  "@vision/sport-basketball",
  "@vision/ui",
  "@vision/yahoo-bridge",
];

const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: workspacePackages,
  // `next dev` otherwise writes its own AGENTS.md/CLAUDE.md into this folder
  // whenever an AI agent starts it; the repo's root CLAUDE.md carries the one
  // pointer that block adds (Next's bundled docs).
  agentRules: false,
  experimental: {
    // An extension snapshot of a 20-team league can pass Next's 1 MB default.
    // This 2 MB limit is app-wide, for every server action; the snapshot
    // actions cap their own payload at 1.5 MB (`MAX_SNAPSHOT_BYTES`).
    serverActions: { bodySizeLimit: "2mb" },
  },
  env: {
    // Surfaces the app's package.json version to the SiteFooter; source imports
    // cannot reach it (parent-relative imports are lint-banned).
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/images/netlifyLoader.ts",
  },
  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
  },
  // Crawlers and password managers probe these conventional root paths without
  // reading the page's <link> tags; unanswered, they 404 and the host's default
  // icon stands in. Next serves the app/apple-icon.png convention at
  // /apple-icon.png, so alias the legacy names to it rather than ship a copy.
  async rewrites() {
    return [
      { source: "/apple-touch-icon.png", destination: "/apple-icon.png" },
      { source: "/apple-touch-icon-precomposed.png", destination: "/apple-icon.png" },
    ];
  },
};

export default nextConfig;
