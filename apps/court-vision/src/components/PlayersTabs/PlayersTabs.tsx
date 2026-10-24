"use client";

import { type PlayerOwnerFilter } from "@/lib/players/ownerFilter";
import { StatViewTabs } from "@vision/ui/components/StatViewTabs/StatViewTabs";
import {
  buildPlayersHref,
  DEFAULT_SORT_DIR,
  DEFAULT_STAT_MODE,
  defaultSortFor,
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
  owner: PlayerOwnerFilter;
};

// Switching tabs keeps the search, page size, game range and roster status, and lands on the
// new tab's first page in its own default order.
export function PlayersTabs({ active, q, size, range, owner }: PlayersTabsProps) {
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
          sort: defaultSortFor({ tab: entry.tab }),
          dir: DEFAULT_SORT_DIR,
          range,
          mode: DEFAULT_STAT_MODE,
          owner,
          minimums: true,
          tab: entry.tab,
        }),
      }))}
    />
  );
}
