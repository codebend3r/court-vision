// Sanitizes a post-auth `next` redirect target. Only same-origin, absolute
// paths are allowed; anything that could send the user off-site (absolute URLs,
// protocol-relative `//evil.com`, backslash-smuggled `/\evil.com`, or a missing
// leading slash) collapses to the safe default so `next` can never be an open
// redirect.
const DEFAULT_PATH = "/";

// Resolving against an unreachable origin turns "did this escape?" into an
// origin comparison the URL parser answers for us.
const BASE_ORIGIN = "https://placeholder.invalid";

export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0) {
    return DEFAULT_PATH;
  }

  // The WHATWG URL parser strips tab, LF, and CR *before* parsing, so a prefix
  // check alone is not enough: "/\t/evil.com" starts with a single slash and
  // clears every string guard, then collapses to "//evil.com" and resolves
  // cross-origin. Remove those characters first so the guards below, and the
  // parser, see the same string the browser will.
  const stripped = raw.replace(/[\t\n\r]/g, "");

  // Must be an absolute path, and must not be protocol-relative (`//`) or use a
  // backslash the browser normalizes to `/` (`/\`), both of which escape origin.
  if (!stripped.startsWith("/") || stripped.startsWith("//") || stripped.startsWith("/\\")) {
    return DEFAULT_PATH;
  }

  // Final authority: resolve it and confirm the origin actually held.
  try {
    const url = new URL(stripped, BASE_ORIGIN);
    return url.origin === BASE_ORIGIN ? `${url.pathname}${url.search}${url.hash}` : DEFAULT_PATH;
  } catch {
    return DEFAULT_PATH;
  }
}
