import { resolve } from "node:path";

import type { NextConfig } from "next";

import packageJson from "./package.json";

// The monorepo root. Turbopack only compiles files under its root, and the
// workspace libs (libs/*) live beside this app, not inside it; file tracing
// must agree with Turbopack or Next warns and picks one itself.
const workspaceRoot = resolve(import.meta.dirname, "../..");

// Workspace libs ship TypeScript source, not a build, so Next compiles them.
const workspacePackages: string[] = [];

// App-wide security headers. CSP here is limited to `frame-ancestors` (the
// modern, header-independent clickjacking guard); a full script/style CSP needs
// per-request nonces (Next injects inline bootstrap + theme scripts) and is left
// as a follow-up so this change can't silently break rendering.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: workspacePackages,
  // `next dev` otherwise writes its own AGENTS.md/CLAUDE.md into this folder
  // whenever an AI agent starts it; the repo's root CLAUDE.md carries the one
  // pointer that block adds (Next's bundled docs).
  agentRules: false,
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
    return [{ source: "/:path*", headers: securityHeaders }];
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
