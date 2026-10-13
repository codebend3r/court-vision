// Team name → URL slug for /my-teams/<slug> edit routes: "Bench Mob" →
// "bench-mob". Display names come from the stored team; the slug only
// locates it.
export const teamNameToSlug = ({ name }: { name: string }): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
