// Team-name ↔ URL-slug conversion for /my-teams/<slug> edit routes.
// "Bench Mob" → "bench-mob". The reverse is a best-effort title-casing —
// display names should come from the stored team, the slug only locates it.

export const teamNameToSlug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

export const teamSlugToName = (slug: string): string =>
  slug
    .split("-")
    .filter((part) => part !== "")
    .map((part) => `${(part[0] ?? "").toUpperCase()}${part.slice(1)}`)
    .join(" ");
