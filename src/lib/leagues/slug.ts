// Collision-proof slugs within one owner scope: "my-league" → "my-league-2".
export const uniqueSlug = ({ base, taken }: { base: string; taken: readonly string[] }): string => {
  if (!taken.includes(base)) return base;
  const candidate = Array.from(
    { length: taken.length + 1 },
    (_, index) => `${base}-${index + 2}`,
  ).find((suffixed) => !taken.includes(suffixed));
  return candidate ?? `${base}-${taken.length + 2}`;
};
