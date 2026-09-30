"use client";

import { StatViewTabs } from "@/components/StatViewTabs/StatViewTabs";
import {
  buildPlayersHref,
  DEFAULT_ADVANCED_SORT_KEY,
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_KEY,
  DEFAULT_STARRED_SORT_KEY,
  type PlayerGameRange,
  type PlayersTab,
} from "@/lib/players/searchParams";

const TAB_ENTRIES: ReadonlyArray<{ tab: PlayersTab; label: string }> = [
  { tab: "regular", label: "Regular Stats" },
  { tab: "advanced", label: "Advanced Stats" },
  { tab: "fantasy", label: "Fantasy Value" },
  { tab: "starred", label: "Starred" },
];

export type PlayersTabsProps = {
  active: PlayersTab;
  q: string;
  size: number;
  range: PlayerGameRange;
};

export function PlayersTabs({ active, q, size, range }: PlayersTabsProps) {
  return (
    <StatViewTabs
      label="Player stat views"
      entries={TAB_ENTRIES.map((entry) => ({
        key: entry.tab,
        label: entry.label,
        isActive: entry.tab === active,
        href: buildPlayersHref({
          q,
          page: 1,
          size,
          sort:
            entry.tab === "advanced"
              ? DEFAULT_ADVANCED_SORT_KEY
              : entry.tab === "starred"
                ? DEFAULT_STARRED_SORT_KEY
                : DEFAULT_SORT_KEY,
          dir: DEFAULT_SORT_DIR,
          range,
          mode: "average",
          minimums: true,
          tab: entry.tab,
        }),
      }))}
    />
  );
}
