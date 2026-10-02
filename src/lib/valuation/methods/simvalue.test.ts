import { describe, expect, it } from "bun:test";

import { CATEGORY_KEYS, categoryValue } from "@/lib/valuation/categories";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import { SIM_ITERATIONS, scoreSimValue } from "@/lib/valuation/methods/simvalue";
import { computePoolStats } from "@/lib/valuation/pool";
import { buildLeague, type SyntheticLeague } from "@/lib/valuation/rosters";
import {
  type Category,
  type CategoryContribution,
  type FantasyStatLine,
  type PlayerValue,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";

const config = (overrides: Partial<ValuationConfig> = {}): ValuationConfig => ({
  categories: ["pts", "reb"],
  weights: {},
  basis: "perGame",
  teams: 2,
  rosterSlots: 2,
  scoring: DEFAULT_POINTS_SCORING,
  ...overrides,
});

// A spread of scorers so the synthetic teams differ and the simulation has a
// real opponent distribution to draw from.
const lines: FantasyStatLine[] = [
  makeStatLine({ playerId: 1, gamesPlayed: 10, pts: 500, reb: 150 }),
  makeStatLine({ playerId: 2, gamesPlayed: 10, pts: 380, reb: 130 }),
  makeStatLine({ playerId: 3, gamesPlayed: 10, pts: 300, reb: 110 }),
  makeStatLine({ playerId: 4, gamesPlayed: 10, pts: 220, reb: 90 }),
  makeStatLine({ playerId: 5, gamesPlayed: 10, pts: 150, reb: 70 }),
  makeStatLine({ playerId: 6, gamesPlayed: 10, pts: 90, reb: 50 }),
];

const poolStats = computePoolStats({ lines, basis: "perGame", poolSize: 6, range: "all" });

describe("scoreSimValue", () => {
  it("is deterministic — the same player always simulates the same weeks", () => {
    const first = scoreSimValue({ lines, poolStats, config: config() });
    const second = scoreSimValue({ lines, poolStats, config: config() });
    expect(first.map((value) => value.total)).toEqual(second.map((value) => value.total));
  });

  it("judges every player against the same simulated season", () => {
    // Two identical lines under different ids must score identically; if each
    // player drew its own opponents they would differ by simulation luck.
    const twins = [
      makeStatLine({ playerId: 10, gamesPlayed: 10, pts: 300, reb: 110 }),
      makeStatLine({ playerId: 11, gamesPlayed: 10, pts: 300, reb: 110 }),
    ];
    const values = scoreSimValue({ lines: [...lines, ...twins], poolStats, config: config() });
    const first = values.find((value) => value.playerId === 10)?.total;
    const second = values.find((value) => value.playerId === 11)?.total;
    expect(first).toBe(second ?? Number.NaN);
  });

  it("values a stronger player above a weaker one", () => {
    const values = scoreSimValue({ lines, poolStats, config: config() });
    const best = values.find((value) => value.playerId === 1)?.total ?? 0;
    const worst = values.find((value) => value.playerId === 6)?.total ?? 0;
    expect(best).toBeGreaterThan(worst);
  });

  it("cannot add more category wins than there are categories", () => {
    const values = scoreSimValue({ lines, poolStats, config: config() });
    values.forEach((value) => {
      expect(value.total).toBeLessThanOrEqual(config().categories.length);
      expect(value.total).toBeGreaterThanOrEqual(-config().categories.length);
    });
  });

  it("pays nothing for a category punted to weight 0", () => {
    const values = scoreSimValue({
      lines,
      poolStats,
      config: config({ weights: { pts: 0, reb: 0 } }),
    });
    expect(values.every((value) => value.total === 0)).toBe(true);
  });

  it("reports a per-category marginal win rate, not a raw count", () => {
    const values = scoreSimValue({ lines, poolStats, config: config(), iterations: 100 });
    const best = values.find((value) => value.playerId === 1);
    const rate = best?.breakdown.pts?.raw ?? 0;
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThanOrEqual(1);
  });

  it("never pays for a player below the replacement band", () => {
    const values = scoreSimValue({ lines, poolStats, config: config() });
    // Player 6 is the weakest line in the pool — worse than what the waiver
    // wire offers — so rostering him cannot add category wins.
    const marginal = values.find((value) => value.playerId === 6)?.total ?? 0;
    expect(marginal).toBeLessThanOrEqual(0);
  });

  it("scales the payoff with how far above replacement a player is", () => {
    const values = scoreSimValue({ lines, poolStats, config: config() });
    const star = values.find((value) => value.playerId === 1)?.total ?? 0;
    const fringe = values.find((value) => value.playerId === 5)?.total ?? 0;
    expect(star).toBeGreaterThan(fringe);
  });
});

// The pass-over-every-week implementation the binary search replaced, kept
// verbatim (SIM_SEED, mulberry32, standardNormal, and the scorer itself) so
// the faster one is held to exactly its output, not to a tolerance.
const SIM_SEED = 0x5eed;

const mulberry32 = ({ seed }: { seed: number }) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const standardNormal = ({ random }: { random: () => number }): number => {
  const u = Math.max(random(), Number.MIN_VALUE);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const referenceScoreSimValue = ({
  lines,
  poolStats,
  config,
  league,
  iterations = SIM_ITERATIONS,
}: {
  lines: readonly FantasyStatLine[];
  poolStats: PoolStats;
  config: ValuationConfig;
  league?: SyntheticLeague;
  iterations?: number;
}): PlayerValue[] => {
  const { replacement, spread } = league ?? buildLeague({ lines, poolStats, config });

  const random = mulberry32({ seed: SIM_SEED });
  const opponents = config.categories.reduce<Partial<Record<Category, number[]>>>(
    (acc, category) => {
      const { mean, sd } = spread[category] ?? { mean: 0, sd: 0 };
      return {
        ...acc,
        [category]: Array.from(
          { length: iterations },
          () => mean + sd * standardNormal({ random }),
        ),
      };
    },
    {},
  );

  return lines.map((line) => {
    const breakdown = config.categories.reduce<Partial<Record<Category, CategoryContribution>>>(
      (acc, category) => {
        const { mean } = spread[category] ?? { mean: 0 };
        const weeks = opponents[category] ?? [];
        const value = categoryValue({
          line,
          category,
          basis: config.basis,
          leagueFgPct: poolStats.leagueFgPct,
          leagueFtPct: poolStats.leagueFtPct,
        });
        const withPlayer = mean + (value - (replacement[category] ?? 0));
        const gained = weeks.reduce(
          (sum, opponent) => sum + ((withPlayer > opponent ? 1 : 0) - (mean > opponent ? 1 : 0)),
          0,
        );
        const raw = weeks.length === 0 ? 0 : gained / weeks.length;
        return { ...acc, [category]: { raw, weighted: raw * (config.weights[category] ?? 1) } };
      },
      {},
    );

    const total = config.categories.reduce(
      (sum, category) => sum + (breakdown[category]?.weighted ?? 0),
      0,
    );
    return { playerId: line.playerId, total, breakdown };
  });
};

// A seeded pool of 300 box-score lines: realistic magnitudes, a few
// zero-attempt shooters, and enough spread that many players sit near a
// category's win threshold, where an off-by-one count would show.
const randomPool = ({ seed, size }: { seed: number; size: number }): FantasyStatLine[] => {
  const random = mulberry32({ seed });
  const between = (low: number, high: number): number =>
    Math.floor(low + random() * (high - low + 1));
  return Array.from({ length: size }, (_, index) => {
    const gamesPlayed = between(1, 82);
    const fga = index % 37 === 0 ? 0 : between(0, 20) * gamesPlayed;
    const fta = index % 41 === 0 ? 0 : between(0, 9) * gamesPlayed;
    return makeStatLine({
      playerId: index + 1,
      gamesPlayed,
      minutes: between(5, 38) * gamesPlayed,
      pts: between(0, 34) * gamesPlayed,
      reb: between(0, 14) * gamesPlayed,
      ast: between(0, 11) * gamesPlayed,
      stl: between(0, 3) * gamesPlayed,
      blk: between(0, 3) * gamesPlayed,
      fg3m: between(0, 5) * gamesPlayed,
      tov: between(0, 5) * gamesPlayed,
      fga,
      fgm: Math.floor(fga * (0.35 + random() * 0.3)),
      fta,
      ftm: Math.floor(fta * (0.55 + random() * 0.4)),
    });
  });
};

describe("scoreSimValue against the per-week reference", () => {
  const pool = randomPool({ seed: 0xc0ffee, size: 300 });
  const allCategories = config({ categories: [...CATEGORY_KEYS], teams: 12, rosterSlots: 13 });

  const cases: {
    name: string;
    lines: FantasyStatLine[];
    config: ValuationConfig;
    iterations?: number;
  }[] = [
    { name: "the fixture pool", lines, config: config() },
    { name: "a punted pool", lines, config: config({ weights: { pts: 0, reb: 0 } }) },
    { name: "a hundred iterations", lines, config: config(), iterations: 100 },
    { name: "no iterations", lines, config: config(), iterations: 0 },
    { name: "no categories", lines, config: config({ categories: [] }) },
    {
      // Identical lines make every team identical: zero spread, so every
      // simulated week ties the average team exactly.
      name: "a league with no spread",
      lines: Array.from({ length: 6 }, (_, index) =>
        makeStatLine({ playerId: index + 1, gamesPlayed: 10 }),
      ),
      config: config(),
    },
    { name: "a seeded 300-player pool, every category", lines: pool, config: allCategories },
    {
      name: "a seeded pool on totals with weights",
      lines: pool,
      config: { ...allCategories, basis: "total", weights: { pts: 2, tov: 0, fg: 0.5 } },
    },
  ];

  cases.forEach(({ name, lines: caseLines, config: caseConfig, iterations }) => {
    it(`matches exactly on ${name}`, () => {
      const poolStats = computePoolStats({
        lines: caseLines,
        basis: caseConfig.basis,
        poolSize: 150,
        range: "all",
      });
      const args = { lines: caseLines, poolStats, config: caseConfig, iterations };
      expect(scoreSimValue(args)).toStrictEqual(referenceScoreSimValue(args));
    });
  });

  it("matches exactly when handed a prebuilt league", () => {
    const poolStats = computePoolStats({
      lines: pool,
      basis: "perGame",
      poolSize: 150,
      range: "all",
    });
    const league = buildLeague({ lines: pool, poolStats, config: allCategories });
    const args = { lines: pool, poolStats, config: allCategories, league };
    expect(scoreSimValue(args)).toStrictEqual(referenceScoreSimValue(args));
  });
});
