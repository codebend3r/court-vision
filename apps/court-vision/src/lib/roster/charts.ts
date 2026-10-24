import {
  baselineFor,
  buildBars,
  qualifyingGames,
  type BarDatum,
  type StatDirection,
  type StatSpec,
} from "@/lib/roster/compare";

// One small chart: a stat, and each rostered player's place on it.
export type RosterChart = {
  key: string;
  label: string;
  fullName: string;
  direction: StatDirection;
  bars: BarDatum[];
};

type RosterRowLike = { id: number; lastName: string; fullName: string };

/**
 * A chart per stat, every rostered player ranked on it and set against the
 * league: the pool's players with at least half the typical games, so a
 * handful-of-games call-up doesn't drag the bar down.
 */
export const buildRosterCharts = <Row extends RosterRowLike>({
  rows,
  pool,
  specs,
  gamesOf,
}: {
  rows: readonly Row[];
  pool: readonly Row[];
  specs: readonly StatSpec<Row>[];
  // The games behind a row's numbers, which is what qualifies it as baseline.
  gamesOf: (row: Row) => number;
}): RosterChart[] => {
  const minimum = qualifyingGames({ games: pool.map(gamesOf) });
  return specs.map((spec) => ({
    key: spec.key,
    label: spec.label,
    fullName: spec.fullName,
    direction: spec.direction,
    bars: buildBars({
      rows,
      spec,
      baseline: baselineFor({ pool, spec, qualifies: (row) => gamesOf(row) >= minimum }),
    }),
  }));
};
