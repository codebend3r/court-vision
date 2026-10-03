// Position strings arrive in each provider's own format ("F-C", "C/LW",
// "SS,2B"). Split on the sport's separators, normalize, keep the groups the
// sport recognizes, and drop repeats while keeping first-seen order.
export const parsePositionGroups =
  <G extends string>({
    separators,
    isGroup,
  }: {
    separators: RegExp;
    isGroup: (value: string) => value is G;
  }) =>
  (position: string | null): G[] =>
    (position ?? "")
      .split(separators)
      .map((part) => part.trim().toUpperCase())
      .filter(isGroup)
      .filter((group, index, groups) => groups.indexOf(group) === index);

// A guard for membership in a sport's own group (or slot, or key) list.
export const memberOf =
  <T extends string>({ values }: { values: readonly T[] }) =>
  (value: string): value is T =>
    values.some((entry) => entry === value);
