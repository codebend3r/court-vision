import { formatRate } from "@vision/core/util/format";
import { ADVANCED_STAT_META, type AdvancedStatMeta } from "@/lib/players/advancedStatMeta";
import { type PlayerPoolRow } from "@/lib/players/search";
import { type AdvancedPlayerRow } from "@/lib/players/searchAdvanced";
import { type AdvancedMetricKey, type PlayerStatMode } from "@/lib/players/searchParams";
import { type StatDirection, type StatSpec } from "@/lib/roster/compare";

// The nine categories a fantasy league scores, which are the numbers a manager
// compares their players on.
const COUNTING = [
  { key: "pts", label: "PTS", fullName: "Points" },
  { key: "reb", label: "REB", fullName: "Rebounds" },
  { key: "ast", label: "AST", fullName: "Assists" },
  { key: "stl", label: "STL", fullName: "Steals" },
  { key: "blk", label: "BLK", fullName: "Blocks" },
  { key: "fg3m", label: "3PM", fullName: "Three-pointers made" },
  { key: "tov", label: "TOV", fullName: "Turnovers" },
] as const;

const perGame = ({ total, gamesPlayed }: { total: number; gamesPlayed: number }): number | null =>
  gamesPlayed > 0 ? total / gamesPlayed : null;

const rate = ({ made, attempted }: { made: number; attempted: number }): number | null =>
  attempted > 0 ? made / attempted : null;

// Turnovers are the only counting category where fewer is better.
const directionOf = ({ key }: { key: string }): StatDirection => (key === "tov" ? "low" : "high");

export const regularSpecs = ({ mode }: { mode: PlayerStatMode }): StatSpec<PlayerPoolRow>[] => [
  ...COUNTING.map(({ key, label, fullName }): StatSpec<PlayerPoolRow> => ({
    key,
    label,
    fullName,
    direction: directionOf({ key }),
    valueOf: ({ stats }) =>
      mode === "total"
        ? stats[key]
        : perGame({ total: stats[key], gamesPlayed: stats.gamesPlayed }),
    format: (value) => (mode === "total" ? String(value) : value.toFixed(1)),
  })),
  {
    key: "fgPct",
    label: "FG%",
    fullName: "Field goal percentage",
    direction: "high",
    valueOf: ({ stats }) => rate({ made: stats.fgm, attempted: stats.fga }),
    format: (value) => formatRate({ value }),
  },
  {
    key: "ftPct",
    label: "FT%",
    fullName: "Free throw percentage",
    direction: "high",
    valueOf: ({ stats }) => rate({ made: stats.ftm, attempted: stats.fta }),
    format: (value) => formatRate({ value }),
  },
];

// Pace and usage describe how a player is used, not how well, and a defensive
// rating or turnover ratio is better the lower it is.
const ADVANCED_DIRECTION: Record<AdvancedMetricKey, StatDirection> = {
  pie: "high",
  pace: "neutral",
  assistPercentage: "high",
  assistRatio: "high",
  assistToTurnover: "high",
  defensiveRating: "low",
  defensiveReboundPercentage: "high",
  effectiveFieldGoalPercentage: "high",
  netRating: "high",
  offensiveRating: "high",
  offensiveReboundPercentage: "high",
  reboundPercentage: "high",
  trueShootingPercentage: "high",
  turnoverRatio: "low",
  usagePercentage: "neutral",
};

const advancedSpec = ({ meta }: { meta: AdvancedStatMeta }): StatSpec<AdvancedPlayerRow> => ({
  key: meta.key,
  label: meta.label,
  fullName: meta.fullName,
  direction: ADVANCED_DIRECTION[meta.key],
  valueOf: ({ stats }) => stats[meta.key],
  format: (value) => (meta.kind === "percentage" ? formatRate({ value }) : value.toFixed(1)),
});

export const advancedSpecs = (): StatSpec<AdvancedPlayerRow>[] =>
  ADVANCED_STAT_META.map((meta) => advancedSpec({ meta }));
