// How a stat should be read when judging a player: more is better, less is
// better (turnovers), or neither (pace, usage describe a role, not quality).
export type StatDirection = "high" | "low" | "neutral";

export type Tier = "strong" | "average" | "weak" | "neutral";

export type StatSpec<Row> = {
  key: string;
  label: string;
  fullName: string;
  direction: StatDirection;
  valueOf: (row: Row) => number | null;
  format: (value: number) => string;
};

export type BarDatum = {
  id: number;
  // Last name, which is what fits beside a bar.
  name: string;
  fullName: string;
  value: number;
  label: string;
  percentile: number;
  tier: Tier;
};

type Ranked = { id: number; lastName: string; fullName: string };

const STRONG_FROM = 67;
const WEAK_UPTO = 33;

const median = ({ values }: { values: readonly number[] }): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
};

/**
 * The games a player needs to count toward the league baseline: half the
 * median games played, so a call-up with one game doesn't set the bar. At
 * least one, so an empty-handed player never qualifies.
 */
export const qualifyingGames = ({ games }: { games: readonly number[] }): number =>
  Math.max(1, Math.floor(median({ values: games }) / 2));

/**
 * Where a value sits in a baseline, 0 to 100: the share of the baseline below
 * it, counting ties as half. An empty baseline has no opinion, so it reads 50.
 */
export const percentileOf = ({
  value,
  baseline,
}: {
  value: number;
  baseline: readonly number[];
}): number => {
  if (baseline.length === 0) return 50;
  const below = baseline.filter((other) => other < value).length;
  const equal = baseline.filter((other) => other === value).length;
  return ((below + equal / 2) / baseline.length) * 100;
};

export const tierOf = ({
  percentile,
  direction,
}: {
  percentile: number;
  direction: StatDirection;
}): Tier => {
  if (direction === "neutral") return "neutral";
  const standing = direction === "low" ? 100 - percentile : percentile;
  if (standing >= STRONG_FROM) return "strong";
  if (standing <= WEAK_UPTO) return "weak";
  return "average";
};

/**
 * One chart's bars: every rostered player with a value, best first (lowest
 * first for a lower-is-better stat), each placed against the league baseline.
 */
export const buildBars = <Row extends Ranked>({
  rows,
  spec,
  baseline,
}: {
  rows: readonly Row[];
  spec: StatSpec<Row>;
  baseline: readonly number[];
}): BarDatum[] =>
  rows
    .flatMap((row) => {
      const value = spec.valueOf(row);
      return value === null ? [] : [{ row, value }];
    })
    .sort(
      (a, b) =>
        (spec.direction === "low" ? a.value - b.value : b.value - a.value) ||
        a.row.fullName.localeCompare(b.row.fullName),
    )
    .map(({ row, value }): BarDatum => {
      const percentile = percentileOf({ value, baseline });
      return {
        id: row.id,
        name: row.lastName,
        fullName: row.fullName,
        value,
        label: spec.format(value),
        percentile,
        tier: tierOf({ percentile, direction: spec.direction }),
      };
    });

/** The league's values for one stat, from the players who qualify. */
export const baselineFor = <Row>({
  pool,
  spec,
  qualifies,
}: {
  pool: readonly Row[];
  spec: StatSpec<Row>;
  qualifies: (row: Row) => boolean;
}): number[] =>
  pool
    .filter(qualifies)
    .map((row) => spec.valueOf(row))
    .filter((value): value is number => value !== null);
