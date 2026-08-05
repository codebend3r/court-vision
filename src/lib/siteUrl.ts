// The app's canonical public origin, in one place.
//
// Two callers need it and they can see different things: page metadata is built
// at module scope with no request in hand, while a Server Action can read the
// incoming request's `Origin` header. Both resolve through here so a share card
// and a confirmation email can never disagree about which host this app is.
//
// Netlify injects `URL` (the production site) and `DEPLOY_PRIME_URL` (the branch
// or preview deploy) at build time. `NEXT_PUBLIC_SITE_URL` overrides both once a
// custom domain is live. The request origin is deliberately last before the
// fallback: it is attacker-influencable, so a configured value always wins, and
// it exists only so `bun dev` on an arbitrary port still mails itself a link
// that resolves.

const FALLBACK_ORIGIN = "http://localhost:3000";

// Reduces a candidate to a bare scheme+host+port, or rejects it. Anything that
// isn't a parseable absolute http(s) URL is treated as unset rather than
// interpolated into a redirect target.
function toOrigin(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function siteOriginFromEnv(): string | null {
  return (
    toOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    toOrigin(process.env.DEPLOY_PRIME_URL) ??
    toOrigin(process.env.URL)
  );
}

export function resolveSiteOrigin({
  requestOrigin,
}: { requestOrigin?: string | null } = {}): string {
  return siteOriginFromEnv() ?? toOrigin(requestOrigin) ?? FALLBACK_ORIGIN;
}
