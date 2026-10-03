import {
  type Category,
  type PoolDef,
  type SportDescriptor,
  type SportKeys,
} from "#core/sport/types";
import { recordFromKeys } from "#core/util/record";
import { categoryDef, categoryValue, ratioDefs } from "#core/valuation/categories";
import {
  type Basis,
  type CategoryPoolStats,
  type PoolStats,
  type ValuationLine,
} from "#core/valuation/types";

// Each ratio category's league rate over `lines`: Σ numerator ÷ Σ denominator,
// so high-volume players weigh in proportion (attempt-weighted FG%).
export const leagueRates = <K extends SportKeys>({
  sport,
  lines,
}: {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
}): Record<K["ratio"], number> => {
  const defs = ratioDefs({ sport });
  return recordFromKeys({
    keys: defs.map((def) => def.key),
    value: (key) => {
      const def = sport.ratio[key];
      const totals = lines.reduce(
        (acc, line) => ({
          numerator: acc.numerator + line.stats[def.numerator],
          denominator: acc.denominator + line.stats[def.denominator],
        }),
        { numerator: 0, denominator: 0 },
      );
      return totals.denominator > 0 ? totals.numerator / totals.denominator : 0;
    },
  });
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
// the stored second moments. For a ratio category the per-game impact is
// scale · (numerator − L · denominator), so Var = scale² · (E[(num − L·den)²]
// − E[num − L·den]²), which the (sq, cross) sums reconstruct for any league
// rate L. A lower-is-better sign flip leaves variance unchanged. Totals basis
// scales by games played (variance of a sum of n games).
const withinVariance = <K extends SportKeys>({
  sport,
  line,
  category,
  basis,
  leagueRate,
}: {
  sport: SportDescriptor<K>;
  line: ValuationLine<K>;
  category: Category<K>;
  basis: Basis;
  leagueRate: Record<K["ratio"], number>;
}): number => {
  const games = line.gamesPlayed;
  if (games < 2) return 0;
  const def = categoryDef({ sport, category });
  const perGameVariance = (() => {
    if (def.kind === "counting") {
      const mean = line.stats[def.stat] / games;
      return Math.max(0, line.sq[def.stat] / games - mean ** 2);
    }
    const league = leagueRate[def.key];
    const made = line.stats[def.numerator];
    const att = line.stats[def.denominator];
    const madeSq = line.sq[def.numerator];
    const attSq = line.sq[def.denominator];
    const crossSum = line.cross[def.key];
    const mean = (made - league * att) / games;
    const meanSq = (madeSq - 2 * league * crossSum + league * league * attSq) / games;
    return Math.max(0, meanSq - mean ** 2) * def.scale * def.scale;
  })();
  return basis === "perGame" ? perGameVariance : perGameVariance * games;
};

const statsOver = <K extends SportKeys>({
  sport,
  lines,
  basis,
}: {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  basis: Basis;
}): PoolStats<K> => {
  const leagueRate = leagueRates({ sport, lines });
  const stat = (category: Category<K>): CategoryPoolStats => {
    const between = meanSigma(
      lines.map((line) => categoryValue({ sport, line, category, basis, leagueRate })),
    );
    // "Typical" game-level volatility (PRD §6.2): pool mean of each player's
    // own within variance for the category.
    const withinMean =
      lines.length === 0
        ? 0
        : lines.reduce(
            (sum, line) => sum + withinVariance({ sport, line, category, basis, leagueRate }),
            0,
          ) / lines.length;
    return { ...between, sigmaWithin: Math.sqrt(withinMean) };
  };
  return {
    poolSize: lines.length,
    leagueRate,
    byCategory: recordFromKeys({ keys: sport.categoryOrder, value: stat }),
  };
};

const provisionalTotal = <K extends SportKeys>({
  sport,
  line,
  stats,
  basis,
}: {
  sport: SportDescriptor<K>;
  line: ValuationLine<K>;
  stats: PoolStats<K>;
  basis: Basis;
}): number =>
  sport.categoryOrder.reduce((total, category) => {
    const { mu, sigma } = stats.byCategory[category];
    if (sigma === 0) return total;
    const value = categoryValue({
      sport,
      line,
      category,
      basis,
      leagueRate: stats.leagueRate,
    });
    return total + (value - mu) / sigma;
  }, 0);

// The sport's first pool unless the caller names one: single-pool sports never
// pass it, split-pool sports value each pool on its own.
export const resolvePool = <K extends SportKeys>({
  sport,
  pool,
}: {
  sport: SportDescriptor<K>;
  pool?: PoolDef<K>;
}): PoolDef<K> => pool ?? sport.pools[0];

// Pool selection with one refinement pass (PRD §5.1): threshold the
// population, rank provisionally on an equal-weight z total, trim to
// poolSize, then recompute league rates and per-category mu/sigma on the
// trimmed pool. Every displayed player is scored against these stats, pool
// member or not. `windowGames` is the lastN window, or null for the season.
export const computePoolStats = <K extends SportKeys>({
  sport,
  pool,
  lines,
  basis,
  poolSize,
  windowGames,
}: {
  sport: SportDescriptor<K>;
  pool?: PoolDef<K>;
  lines: readonly ValuationLine<K>[];
  basis: Basis;
  poolSize: number;
  windowGames: number | null;
}): PoolStats<K> => {
  const { minGamesShare, minPlayingTimePerGame } = resolvePool({ sport, pool });
  const minGames = Math.ceil((windowGames ?? sport.scheduleGames) * minGamesShare);
  const candidates = lines.filter(
    (line) =>
      line.gamesPlayed >= minGames &&
      (line.gamesPlayed > 0 ? line.playingTime / line.gamesPlayed : 0) >= minPlayingTimePerGame,
  );
  const provisional = statsOver({ sport, lines: candidates, basis });
  if (candidates.length <= Math.min(poolSize, 1)) return provisional;
  const members = candidates
    .map((line) => ({ line, total: provisionalTotal({ sport, line, stats: provisional, basis }) }))
    .sort((a, b) => b.total - a.total || a.line.playerId - b.line.playerId)
    .slice(0, poolSize)
    .map((entry) => entry.line);
  return statsOver({ sport, lines: members, basis });
};
