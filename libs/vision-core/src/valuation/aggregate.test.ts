import { describe, expect, it } from "bun:test";

import {
  aggregateWindowLogs,
  makeLog,
  type StatKey,
  type WindowLog,
  type WindowTotals,
} from "#core/testing/basketball";

const log = (overrides: Partial<Record<StatKey | "minutes", number>> = {}): WindowLog =>
  makeLog({
    minutes: 30,
    pts: 20,
    reb: 5,
    ast: 4,
    stl: 1,
    blk: 1,
    fg3m: 2,
    tov: 3,
    fgm: 8,
    fga: 16,
    ftm: 2,
    fta: 3,
    ...overrides,
  });

describe("aggregateWindowLogs", () => {
  it("sums stat totals across the window", () => {
    const totals = aggregateWindowLogs({ logs: [log(), log({ pts: 30, fga: 20 })] });
    expect(totals.stats.pts).toBe(50);
    expect(totals.stats.fga).toBe(36);
    expect(totals.playingTime).toBe(60);
    expect(totals.gamesPlayed).toBe(2);
  });

  it("accumulates second moments for variance reconstruction", () => {
    const totals = aggregateWindowLogs({ logs: [log(), log({ pts: 30, fgm: 10, fga: 20 })] });
    expect(totals.sq.pts).toBe(20 * 20 + 30 * 30);
    expect(totals.sq.fga).toBe(16 * 16 + 20 * 20);
    expect(totals.cross.fg).toBe(8 * 16 + 10 * 20);
    expect(totals.cross.ft).toBe(2 * 3 + 2 * 3);
  });

  it("does not count DNPs (no playing time) as appearances but keeps their zeros", () => {
    const totals = aggregateWindowLogs({
      logs: [log(), log({ minutes: 0, pts: 0, fgm: 0, fga: 0 })],
    });
    expect(totals.gamesPlayed).toBe(1);
    expect(totals.stats.pts).toBe(20);
  });

  it("returns a zeroed line for an empty window", () => {
    const totals = aggregateWindowLogs({ logs: [] });
    expect(totals.gamesPlayed).toBe(0);
    expect(totals.stats.pts).toBe(0);
    expect(totals.stats.fta).toBe(0);
  });
});

// A deliberately naive version (a fresh spread per stat key per game, the shape
// the hot-path version replaced), so the faster one is held to exactly its
// output.
const STAT_KEYS: readonly StatKey[] = [
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "fg3m",
  "tov",
  "fgm",
  "fga",
  "ftm",
  "fta",
];

const ZERO_STATS: Record<StatKey, number> = {
  pts: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  fg3m: 0,
  tov: 0,
  fgm: 0,
  fga: 0,
  ftm: 0,
  fta: 0,
};

const referenceAggregateWindowLogs = ({ logs }: { logs: readonly WindowLog[] }): WindowTotals =>
  logs.reduce<WindowTotals>(
    (totals, game) => ({
      ...STAT_KEYS.reduce<Pick<WindowTotals, "stats" | "sq">>(
        (acc, key) => ({
          stats: { ...acc.stats, [key]: acc.stats[key] + game.stats[key] },
          sq: { ...acc.sq, [key]: acc.sq[key] + game.stats[key] * game.stats[key] },
        }),
        { stats: totals.stats, sq: totals.sq },
      ),
      gamesPlayed: totals.gamesPlayed + (game.playingTime > 0 ? 1 : 0),
      playingTime: totals.playingTime + game.playingTime,
      cross: {
        fg: totals.cross.fg + game.stats.fgm * game.stats.fga,
        ft: totals.cross.ft + game.stats.ftm * game.stats.fta,
      },
    }),
    {
      gamesPlayed: 0,
      playingTime: 0,
      stats: { ...ZERO_STATS },
      sq: { ...ZERO_STATS },
      cross: { fg: 0, ft: 0 },
    },
  );

// Deterministic PRNG (mulberry32) for the seeded logs below.
const seeded = ({ seed }: { seed: number }) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe("aggregateWindowLogs against the naive reference", () => {
  const random = seeded({ seed: 0xa66 });
  const between = (low: number, high: number): number =>
    Math.floor(low + random() * (high - low + 1));
  // Every fifth game a DNP; fractional minutes so a float sum's order would
  // show if it changed.
  const randomLog = (index: number): WindowLog =>
    index % 5 === 0
      ? log({
          minutes: 0,
          pts: 0,
          reb: 0,
          ast: 0,
          stl: 0,
          blk: 0,
          fg3m: 0,
          tov: 0,
          fgm: 0,
          fga: 0,
          ftm: 0,
          fta: 0,
        })
      : log({
          minutes: between(1, 48) + random(),
          pts: between(0, 60),
          reb: between(0, 20),
          ast: between(0, 15),
          stl: between(0, 5),
          blk: between(0, 6),
          fg3m: between(0, 10),
          tov: between(0, 8),
          fgm: between(0, 20),
          fga: between(0, 35),
          ftm: between(0, 15),
          fta: between(0, 18),
        });

  [0, 1, 10, 82].forEach((length) => {
    it(`matches exactly over ${length} seeded games`, () => {
      const logs = Array.from({ length }, (_, index) => randomLog(index));
      expect(aggregateWindowLogs({ logs })).toStrictEqual(referenceAggregateWindowLogs({ logs }));
    });
  });
});
