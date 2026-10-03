import { type Category, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { categoryMeta, categoryPerGame, type CategoryKind } from "#core/valuation/categories";
import { scoreZScore } from "#core/valuation/methods/zscore";
import { computePoolStats } from "#core/valuation/pool";
import { type ValuationConfig, type ValuationLine } from "#core/valuation/types";
import { poolSizeFor } from "#core/valuation/valuePlayers";

export type PlayerCategoryInsight<K extends SportKeys> = {
  key: Category<K>;
  label: string;
  perGame: number; // display value: lower-is-better stats positive, ratios as their rate
  z: number; // sign-corrected raw z (higher is always better)
  kind: CategoryKind;
};

export type PlayerInsight<K extends SportKeys> = {
  playerId: number;
  gamesPlayed: number;
  playingTimePerGame: number;
  z: number; // total z-score across all categories
  overallRank: number; // 1-based rank across the whole pool by z
  overallOf: number;
  positionRank: number | null; // best rank among the player's eligible groups
  positionOf: number | null;
  positionGroup: K["group"] | null;
  categories: PlayerCategoryInsight<K>[];
};

// Precomputed per-player quick stats + z-score ranks for a roster builder's
// hover panel, under one neutral `config` (the builder shows a single read of
// each player, not a configurable one). Pure and server-safe: runs once per
// page load off the cached pool.
export const buildPlayerInsights = <K extends SportKeys>({
  sport,
  lines,
  config,
}: {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  config: ValuationConfig<K>;
}): PlayerInsight<K>[] => {
  const poolStats = computePoolStats({
    sport,
    lines,
    basis: config.basis,
    poolSize: poolSizeFor({ pool: sport.pools[0], config }),
    windowGames: null,
  });
  const zValues = scoreZScore({ sport, lines, poolStats, config });
  const zById = new Map(zValues.map((value) => [value.playerId, value]));
  const parse = sport.positions.parse;

  const overallOf = lines.length;
  const overallRank = [...zValues]
    .sort((a, b) => b.total - a.total || a.playerId - b.playerId)
    .reduce((acc, value, index) => acc.set(value.playerId, index + 1), new Map<number, number>());

  // Rank every eligibility group independently by z, so a player eligible at
  // two groups carries a rank in both pools.
  const rankByGroup = new Map<K["group"], { rank: Map<number, number>; count: number }>(
    sport.positions.groups.map((group) => {
      const eligible = lines.filter((line) =>
        parse(line.position).some((candidate) => candidate === group),
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

  const metas = categoryMeta({ sport });

  return lines.map((line) => {
    const zEntry = zById.get(line.playerId);
    const categories = metas.map((meta) => ({
      key: meta.key,
      label: meta.label,
      perGame: categoryPerGame({ sport, line, category: meta.key }),
      z: zEntry?.breakdown[meta.key]?.raw ?? 0,
      kind: meta.kind,
    }));

    // The player's strongest positional standing (lowest rank number) across
    // the groups they qualify for — matches the engine's best-slot philosophy.
    const best = parse(line.position).reduce<{
      group: K["group"];
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
      playingTimePerGame: line.gamesPlayed > 0 ? line.playingTime / line.gamesPlayed : 0,
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
