// Collision-proof slugs within one owner scope: "my-league" → "my-league-2".
type UniqueSlugProps = { base: string; taken: readonly string[] };

export const uniqueSlug = ({ base, taken }: UniqueSlugProps): string => {
  if (!taken.includes(base)) return base;
  const candidate = Array.from(
    { length: taken.length + 1 },
    (_, index) => `${base}-${index + 2}`,
  ).find((suffixed) => !taken.includes(suffixed));
  return candidate ?? `${base}-${taken.length + 2}`;
};
