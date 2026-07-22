// Sanitizes a post-auth `next` redirect target. Only same-origin, absolute
// paths are allowed; anything that could send the user off-site (absolute URLs,
// protocol-relative `//evil.com`, backslash-smuggled `/\evil.com`, or a missing
// leading slash) collapses to the safe default so `next` can never be an open
// redirect.
const DEFAULT_PATH = "/";

export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0) {
    return DEFAULT_PATH;
  }
  // Must be an absolute path, and must not be protocol-relative (`//`) or use a
  // backslash the browser normalizes to `/` (`/\`), both of which escape origin.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_PATH;
  }
  return raw;
}
