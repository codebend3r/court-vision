import type { NextConfig } from "next";

import packageJson from "./package.json";

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
  env: {
    // Surfaces the package.json version to the SiteFooter; source imports
    // cannot reach the repo root (parent-relative imports are lint-banned).
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/images/netlifyLoader.ts",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
