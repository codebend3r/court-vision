import {
  CATEGORY_KEYS,
  CATEGORY_META,
  COUNTING_STAT_KEY,
  type CategoryKind,
  isCountingCategory,
} from "@/lib/valuation/categories";
import { scoreZScore } from "@/lib/valuation/methods/zscore";
import { parseEligibleGroups, type PositionGroup } from "@/lib/valuation/modifiers/positional";
import { computePoolStats } from "@/lib/valuation/pool";
import { type Category, type FantasyStatLine, type ValuationConfig } from "@/lib/valuation/types";

// Mirrors index.ts POOL_FLOOR (not exported there): small leagues still
// standardize against a broad pool so values stay stable (PRD §5.1).
const POOL_FLOOR = 150;

// The team builder shows a single, neutral read of each player rather than a
// configurable one: every category included, no weights, per-game, standard
// 12-team / 13-slot league. Matches the Fantasy Value tab's defaults.
export const TEAM_BUILDER_VALUATION_CONFIG: ValuationConfig = {
  categories: [...CATEGORY_KEYS],
  weights: {},
  basis: "perGame",
  teams: 12,
  rosterSlots: 13,
};

export type PlayerCategoryInsight = {
  key: Category;
  label: string;
  perGame: number; // display value: TOV positive, FG%/FT% as a 0–1 rate
  z: number; // sign-corrected raw z (higher is always better)
  kind: CategoryKind;
};

export type PlayerInsight = {
  playerId: number;
  gamesPlayed: number;
  minutesPerGame: number;
  z: number; // total z-score across all categories
  overallRank: number; // 1-based rank across the whole pool by z
  overallOf: number;
  positionRank: number | null; // best rank among the player's eligible groups
  positionOf: number | null;
  positionGroup: PositionGroup | null;
  categories: PlayerCategoryInsight[];
};

// Human-readable per-game value for display. Counting stats stay positive
// (TOV is not negated here — the sign lives in its z), ratio stats become the
// underlying make rate.
const displayPerGame = ({
  line,
  category,
}: {
  line: FantasyStatLine;
  category: Category;
}): number => {
  if (!isCountingCategory(category)) {
    const made = category === "fg" ? line.fgm : line.ftm;
    const attempted = category === "fg" ? line.fga : line.fta;
    return attempted > 0 ? made / attempted : 0;
  }
  const total = line[COUNTING_STAT_KEY[category]];
  return line.gamesPlayed > 0 ? total / line.gamesPlayed : 0;
};

// Precomputed per-player quick stats + z-score ranks for the builder's hover
// panel. Pure and server-safe: runs once per page load off the cached pool.
export const buildPlayerInsights = ({
  lines,
}: {
  lines: readonly FantasyStatLine[];
}): PlayerInsight[] => {
  const config = TEAM_BUILDER_VALUATION_CONFIG;
  const poolSize = Math.max(POOL_FLOOR, config.teams * config.rosterSlots);
  const poolStats = computePoolStats({ lines, basis: config.basis, poolSize, range: "all" });
  const zValues = scoreZScore({ lines, poolStats, config });
  const zById = new Map(zValues.map((value) => [value.playerId, value]));

  const overallOf = lines.length;
  const overallRank = [...zValues]
    .sort((a, b) => b.total - a.total || a.playerId - b.playerId)
    .reduce((acc, value, index) => acc.set(value.playerId, index + 1), new Map<number, number>());

  // Rank every eligibility group independently by z, so a G-F player carries a
  // rank in both the guard and forward pools.
  const groups: readonly PositionGroup[] = ["G", "F", "C"];
  const rankByGroup = new Map<PositionGroup, { rank: Map<number, number>; count: number }>(
    groups.map((group) => {
      const eligible = lines.filter((line) =>
        parseEligibleGroups(line.position).some((candidate) => candidate === group),
      );
      const rank = [...eligible]
        .sort(
          (a, b) =>
            (zById.get(b.playerId)?.total ?? 0) - (zById.get(a.playerId)?.total ?? 0) ||
            a.playerId - b.playerId,
        )
        .reduce((acc, line, index) => acc.set(line.playerId, index + 1), new Map<number, number>());
      return [group, { rank, count: eligible.length }];
    }),
  );

  return lines.map((line) => {
    const zEntry = zById.get(line.playerId);
    const categories = CATEGORY_META.map((meta) => ({
      key: meta.key,
      label: meta.label,
      perGame: displayPerGame({ line, category: meta.key }),
      z: zEntry?.breakdown[meta.key]?.raw ?? 0,
      kind: meta.kind,
    }));

    // The player's strongest positional standing (lowest rank number) across
    // the groups they qualify for — matches the engine's best-slot philosophy.
    const best = parseEligibleGroups(line.position).reduce<{
      group: PositionGroup;
      rank: number;
      count: number;
    } | null>((acc, group) => {
      const groupRanks = rankByGroup.get(group);
      const rank = groupRanks?.rank.get(line.playerId);
      if (groupRanks === undefined || rank === undefined) return acc;
      if (acc === null || rank < acc.rank) return { group, rank, count: groupRanks.count };
      return acc;
    }, null);

    return {
      playerId: line.playerId,
      gamesPlayed: line.gamesPlayed,
      minutesPerGame: line.gamesPlayed > 0 ? line.minutes / line.gamesPlayed : 0,
      z: zEntry?.total ?? 0,
      overallRank: overallRank.get(line.playerId) ?? overallOf,
      overallOf,
      positionRank: best?.rank ?? null,
      positionOf: best?.count ?? null,
      positionGroup: best?.group ?? null,
      categories,
    };
  });
};
