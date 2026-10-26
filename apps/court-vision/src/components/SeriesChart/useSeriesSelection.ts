"use client";

import { useMemo } from "react";
import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from "nuqs";

type IsActiveProps<K extends string> = { key: K };

type ToggleProps<K extends string> = { key: K };

type ToggleAllProps<K extends string> = { all: readonly K[] };

export type SeriesSelection<K extends string> = {
  active: readonly K[];
  isActive: (args: IsActiveProps<K>) => boolean;
  toggle: (args: ToggleProps<K>) => void;
  hasActive: boolean;
  // One-shot bulk toggle: clears every series while any is on, otherwise turns
  // on `all`. Clearing lets a reader focus on one series without clicking
  // every chip off first.
  toggleAll: (args: ToggleAllProps<K>) => void;
};

// Which series a chart plots, kept in the URL as a comma list (`?stats=pts,reb`)
// so a view can be shared. An absent param means `defaults`; an empty one
// (`?stats=`) means none. Unknown keys in a hand-edited URL are dropped.
type UseSeriesSelectionProps<K extends string> = {
  param: string;
  keys: readonly K[];
  defaults: readonly K[];
};

export const useSeriesSelection = <K extends string>({
  param,
  keys,
  defaults,
}: UseSeriesSelectionProps<K>): SeriesSelection<K> => {
  const parser = useMemo(() => parseAsArrayOf(parseAsStringLiteral(keys)), [keys]);
  // No `withDefault`: the absent and empty params must stay distinct, and a
  // default would also be cleared from the URL whenever it was re-selected.
  const [value, setValue] = useQueryState(param, parser);
  const active = value ?? defaults;
  const isActive = ({ key }: IsActiveProps<K>): boolean => active.includes(key);
  const hasActive = active.length > 0;

  return {
    active,
    isActive,
    hasActive,
    toggle: ({ key }) =>
      void setValue(
        isActive({ key }) ? active.filter((activeKey) => activeKey !== key) : [...active, key],
      ),
    toggleAll: ({ all }) => void setValue(hasActive ? [] : [...all]),
  };
};
