import type { PlayerGameRange } from "@/lib/players/searchParams";
import {
  CATEGORY_KEYS,
  COUNTING_STAT_KEY,
  categoryValue,
  isCountingCategory,
} from "@/lib/valuation/categories";
import type { Basis, Category, FantasyStatLine, PoolStats } from "@/lib/valuation/types";

// Pool qualification: enough of the window played, at a rotation player's
// minutes load. Replaces the NBA leader minimums used by the other tabs.
export const MIN_GP_SHARE = 0.3;
export const MIN_AVG_MINUTES = 15;
const SCHEDULE_GAMES = 82;

const windowGames = ({ range }: { range: PlayerGameRange }): number =>
  range === "all" ? SCHEDULE_GAMES : Number.parseInt(range.replace("last", ""), 10);

export const attemptWeightedPcts = ({
  lines,
}: {
  lines: readonly FantasyStatLine[];
}): { leagueFgPct: number; leagueFtPct: number } => {
  const totals = lines.reduce(
    (acc, current) => ({
      fgm: acc.fgm + current.fgm,
      fga: acc.fga + current.fga,
      ftm: acc.ftm + current.ftm,
      fta: acc.fta + current.fta,
    }),
    { fgm: 0, fga: 0, ftm: 0, fta: 0 },
  );
  return {
    leagueFgPct: totals.fga > 0 ? totals.fgm / totals.fga : 0,
    leagueFtPct: totals.fta > 0 ? totals.ftm / totals.fta : 0,
  };
};

// Population mean and standard deviation, two-pass for numeric stability.
// Fewer than two values (or no spread) yields sigma 0, which downstream
// scoring treats as "no signal" rather than dividing by it.
export const meanSigma = (values: readonly number[]): { mu: number; sigma: number } => {
  if (values.length < 2) return { mu: values[0] ?? 0, sigma: 0 };
  const mu = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mu) ** 2, 0) / values.length;
  return { mu, sigma: Math.sqrt(variance) };
};

// Per-player game-level variance of a category's per-game value, rebuilt from
// the stored second moments. For ratio categories the impact is
// made − att·L, so Var = E[(made − att·L)²] − E[made − att·L]², which the
// (sq, cross) sums reconstruct for any league percentage L. Totals basis
// scales by games played (variance of a sum of n games).
const withinVariance = ({
  line,
  category,
  basis,
  leagueFgPct,
  leagueFtPct,
}: {
  line: FantasyStatLine;
  category: Category;
  basis: Basis;
  leagueFgPct: number;
  leagueFtPct: number;
}): number => {
  const games = line.gamesPlayed;
  if (games < 2) return 0;
  const perGameVariance = (() => {
    if (isCountingCategory(category)) {
      const key = COUNTING_STAT_KEY[category];
      const mean = line[key] / games;
      return Math.max(0, line.sq[key] / games - mean ** 2);
    }
    const league = category === "fg" ? leagueFgPct : leagueFtPct;
    const made = category === "fg" ? line.fgm : line.ftm;
    const att = category === "fg" ? line.fga : line.fta;
    const madeSq = category === "fg" ? line.sq.fgm : line.sq.ftm;
    const attSq = category === "fg" ? line.sq.fga : line.sq.fta;
    const crossSum = category === "fg" ? line.cross.fg : line.cross.ft;
    const mean = (made - league * att) / games;
    const meanSq = (madeSq - 2 * league * crossSum + league * league * attSq) / games;
    return Math.max(0, meanSq - mean ** 2);
  })();
  return basis === "perGame" ? perGameVariance : perGameVariance * games;
};

const statsOver = ({
  lines,
  basis,
}: {
  lines: readonly FantasyStatLine[];
  basis: Basis;
}): PoolStats => {
  const { leagueFgPct, leagueFtPct } = attemptWeightedPcts({ lines });
  const stat = (category: Category): { mu: number; sigma: number; sigmaWithin: number } => {
    const between = meanSigma(
      lines.map((line) => categoryValue({ line, category, basis, leagueFgPct, leagueFtPct })),
    );
    // "Typical" game-level volatility (PRD §6.2): pool mean of each player's
    // own within variance for the category.
    const withinMean =
      lines.length === 0
        ? 0
        : lines.reduce(
            (sum, line) =>
              sum + withinVariance({ line, category, basis, leagueFgPct, leagueFtPct }),
            0,
          ) / lines.length;
    return { ...between, sigmaWithin: Math.sqrt(withinMean) };
  };
  return {
    poolSize: lines.length,
    leagueFgPct,
    leagueFtPct,
    byCategory: {
      pts: stat("pts"),
      reb: stat("reb"),
      ast: stat("ast"),
      stl: stat("stl"),
      blk: stat("blk"),
      tpm: stat("tpm"),
      tov: stat("tov"),
      fg: stat("fg"),
      ft: stat("ft"),
    },
  };
};

const provisionalTotal = ({
  line,
  stats,
  basis,
}: {
  line: FantasyStatLine;
  stats: PoolStats;
  basis: Basis;
}): number =>
  CATEGORY_KEYS.reduce((total, category) => {
    const { mu, sigma } = stats.byCategory[category];
    if (sigma === 0) return total;
    const value = categoryValue({
      line,
      category,
      basis,
      leagueFgPct: stats.leagueFgPct,
      leagueFtPct: stats.leagueFtPct,
    });
    return total + (value - mu) / sigma;
  }, 0);

// Pool selection with one refinement pass (PRD §5.1): threshold the
// population, rank provisionally on an equal-weight z total, trim to
// poolSize, then recompute league percentages and per-category mu/sigma on
// the trimmed pool. Every displayed player is scored against these stats,
// pool member or not.
export const computePoolStats = ({
  lines,
  basis,
  poolSize,
  range,
}: {
  lines: readonly FantasyStatLine[];
  basis: Basis;
  poolSize: number;
  range: PlayerGameRange;
}): PoolStats => {
  const minGames = Math.ceil(windowGames({ range }) * MIN_GP_SHARE);
  const candidates = lines.filter(
    (line) =>
      line.gamesPlayed >= minGames &&
      (line.gamesPlayed > 0 ? line.minutes / line.gamesPlayed : 0) >= MIN_AVG_MINUTES,
  );
  const provisional = statsOver({ lines: candidates, basis });
  if (candidates.length <= Math.min(poolSize, 1)) return provisional;
  const pool = candidates
    .map((line) => ({ line, total: provisionalTotal({ line, stats: provisional, basis }) }))
    .sort((a, b) => b.total - a.total || a.line.playerId - b.line.playerId)
    .slice(0, poolSize)
    .map((entry) => entry.line);
  return statsOver({ lines: pool, basis });
};
