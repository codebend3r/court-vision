// Response headers every *-vision app sends on every route, from its
// next.config.ts `headers()`. CSP here is limited to `frame-ancestors` (the
// modern, header-independent clickjacking guard); a full script/style CSP needs
// per-request nonces (Next injects inline bootstrap + theme scripts) and is left
// as a follow-up so it can't silently break rendering.
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
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
