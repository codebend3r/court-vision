"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createSerializer } from "nuqs";

import { StatViewTabs } from "@vision/ui/components/StatViewTabs/StatViewTabs";
import { statFilterParsers, type PlayerView } from "@/lib/stats/searchParams";

const VIEW_ENTRIES: ReadonlyArray<{ view: PlayerView; label: string }> = [
  { view: "regular", label: "Regular Stats" },
  { view: "advanced", label: "Advanced Stats" },
  { view: "fantasy", label: "Fantasy Value" },
];

const serialize = createSerializer(statFilterParsers);

// The player page's view switcher. Each href is the live URL with only `view`
// changed, so the season, timeframe, chart chips, and game-log sort all
// survive a switch; the default view clears the param rather than naming it.
export function PlayerViewTabs({ active }: { active: PlayerView }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = new URLSearchParams(searchParams?.toString() ?? "");

  return (
    <StatViewTabs
      label="Player stat views"
      entries={VIEW_ENTRIES.map((entry) => ({
        key: entry.view,
        label: entry.label,
        isActive: entry.view === active,
        href: `${pathname}${serialize(current, { view: entry.view })}`,
      }))}
    />
  );
}
