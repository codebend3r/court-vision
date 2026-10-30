import { describe, expect, it } from "bun:test";

import {
  aggregateWindowLogs,
  buildYardstick,
  CATEGORY_KEYS,
  DEFAULT_POINTS_SCORING,
  makeDatedLog,
  type MethodWeights,
  poolStatsFor,
  type ValuationConfig,
  valuePlayers,
} from "#core/testing/basketball";
import { METHOD_VALUE_KEYS } from "#core/valuation/registry";

// Deterministic PRNG (mulberry32), so the pool has real spread and real
// game-to-game variance without a fixture file.
type SeededProps = { seed: number };

const seeded = ({ seed }: SeededProps) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type SeasonLineProps = { seed: number; position: string | null };

// One player's season, aggregated from 40 seeded box scores.
const seasonLine = ({ seed, position }: SeasonLineProps) => {
  const random = seeded({ seed });
  const between = (low: number, high: number): number =>
    Math.floor(low + random() * (high - low + 1));
  const logs = Array.from({ length: 40 }, (_, index) => {
    const fga = between(2, 26);
    const fta = between(0, 10);
    return makeDatedLog({
      gameDate: new Date(Date.UTC(2025, 9, 21 + index)),
      minutes: between(10, 40),
      pts: between(0, 45),
      reb: between(0, 16),
      ast: between(0, 12),
      stl: between(0, 4),
      blk: between(0, 4),
      fg3m: between(0, 7),
      tov: between(0, 6),
      fga,
      fgm: Math.floor(fga * random()),
      fta,
      ftm: Math.floor(fta * random()),
    });
  });
  // A plain window line: makeStatLine would replace the aggregated stats with
  // its flat defaults.
  return { playerId: seed, position, ...aggregateWindowLogs({ logs }) };
};

const POSITIONS = ["G", "F", "C", "G-F", "F-C", null];

const lines = Array.from({ length: 60 }, (_, index) =>
  seasonLine({ seed: index + 1, position: POSITIONS[index % POSITIONS.length] ?? null }),
);

const config: ValuationConfig = {
  categories: [...CATEGORY_KEYS],
  weights: {},
  basis: "perGame",
  teams: 4,
  rosterSlots: 10,
  scoring: DEFAULT_POINTS_SCORING,
};

// Every weighted method on its own weight set, so a method scored with the
// wrong set would show.
const methodWeights: MethodWeights = {
  z: { pts: 2 },
  g: { tov: 0 },
  vorp: { reb: 1.5 },
  pos: { blk: 2 },
  sgp: { ast: 0.5 },
  sim: { stl: 3 },
};

describe("buildYardstick", () => {
  const poolStats = poolStatsFor({ lines, config, windowGames: null });
  const yardstick = buildYardstick({ lines, poolStats, config, methodWeights });
  const pool = yardstick.value({ lines });

  it("values a pool exactly as valuePlayers does", () => {
    expect(pool).toStrictEqual(
      valuePlayers({ lines, config, methodWeights, windowGames: null }).values,
    );
  });

  it("scores a line on its own exactly as it scores within the whole pool, on every method", () => {
    lines.forEach((line) => {
      const [alone] = yardstick.value({ lines: [line] });
      const within = pool.find((entry) => entry.playerId === line.playerId);
      METHOD_VALUE_KEYS.forEach((key) => {
        expect(alone?.[key]).toBe(within?.[key] ?? Number.NaN);
      });
    });
  });

  it("measures Positional VORP by the line's own position", () => {
    const [first] = lines;
    if (first === undefined) throw new Error("Empty pool");
    const [center] = yardstick.value({ lines: [{ ...first, position: "C" }] });
    const [guard] = yardstick.value({ lines: [{ ...first, position: "G" }] });
    expect(center?.z).toBe(guard?.z ?? Number.NaN);
    expect(center?.positional).not.toBe(guard?.positional ?? Number.NaN);
  });
});
