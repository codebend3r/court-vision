import { type CountingCategoryDef, type SportKeys } from "#core/sport/types";

// A sport's plain counting category: it totals the stat of the same name,
// more is better, and its formula is the standard z-score line. Curried so a
// sport names its keys once and every call infers its own category key:
// `const counting = countingCategory<HockeyKeys>()`.
type CountingCategoryProps<K extends SportKeys, C extends K["counting"] & K["valued"]> = {
  key: C;
  label: string;
  fullName: string;
  description: string;
};

export const countingCategory =
  <K extends SportKeys>() =>
  <C extends K["counting"] & K["valued"]>({
    key,
    label,
    fullName,
    description,
  }: CountingCategoryProps<K, C>): CountingCategoryDef<K> & { key: C } => ({
    kind: "counting",
    key,
    stat: key,
    direction: "higher",
    label,
    fullName,
    description,
    formula: `(${label} − pool avg) ÷ pool std dev × weight`,
  });
