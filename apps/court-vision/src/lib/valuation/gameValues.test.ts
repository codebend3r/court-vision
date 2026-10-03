import { describe, expect, it } from "bun:test";

import { CATEGORY_KEYS } from "@/lib/valuation/categories";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { buildFantasyGameValues } from "@/lib/valuation/gameValues";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import { computePoolStats } from "@/lib/valuation/pool";
import { buildFantasyTrend } from "@/lib/valuation/trend";
import { type MethodWeights, type ValuationConfig } from "@/lib/valuation/types";
import { type DatedLog } from "@/lib/watchlist/trend";

const log = ({
  day,
  pts = 25,
  minutes = 34,
}: {
  day: number;
  pts?: number;
  minutes?: number;
}): DatedLog => ({
  gameDate: new Date(Date.UTC(2026, 0, day)),
  minutes,
  pts,
  reb: 6,
  ast: 5,
  stl: 1,
  blk: 1,
  fg3m: 2,
  tov: 2,
  fgm: 9,
  fga: 18,
  ftm: 5,
  fta: 6,
});

// A pool spread out in every category so each sigma is honestly non-zero.
const poolLine = (index: number) =>
  makeStatLine({
    playerId: index + 100,
    pts: 300 + index * 30,
    reb: 150 + index * 10,
    ast: 100 + index * 8,
    stl: 30 + index * 3,
    blk: 15 + index * 2,
    fg3m: 40 + index * 5,
    tov: 60 + index * 4,
    fgm: 150 + index * 12,
    fga: 350 + index * 20,
    ftm: 80 + index * 6,
    fta: 100 + index * 7,
  });

const star = makeStatLine({ playerId: 7, fullName: "Luka Doncic", pts: 1500 });
const lines = [star, ...Array.from({ length: 20 }, (_, index) => poolLine(index))];
const poolStats = computePoolStats({ lines, basis: "perGame", poolSize: 150, range: "all" });
const config: ValuationConfig = {
  categories: [...CATEGORY_KEYS],
  weights: {},
  basis: "perGame",
  teams: 12,
  rosterSlots: 13,
  scoring: DEFAULT_POINTS_SCORING,
};

const build = ({
  logs,
  categories = [...CATEGORY_KEYS],
  methodWeights = {},
}: {
  logs: DatedLog[];
  categories?: ValuationConfig["categories"];
  methodWeights?: MethodWeights;
}) =>
  buildFantasyGameValues({
    line: star,
    logs,
    poolStats,
    config: { ...config, categories },
    methodWeights,
  });

describe("buildFantasyGameValues", () => {
  it("values each game on its own, so a big night outscores a quiet one", () => {
    const [big, quiet] = build({ logs: [log({ day: 1, pts: 40 }), log({ day: 2, pts: 10 })] });

    expect(big?.z ?? 0).toBeGreaterThan(quiet?.z ?? 0);
    expect(big?.g ?? 0).toBeGreaterThan(quiet?.g ?? 0);
  });

  it("gives a missed game no value rather than scoring it as a zero night", () => {
    const [, missed] = build({ logs: [log({ day: 1 }), log({ day: 2, minutes: 0 })] });

    expect(missed?.z).toBeNull();
    expect(missed?.g).toBeNull();
    expect(missed?.categories).toEqual({});
  });

  it("carries each game's rolling value, the same one the trend chart plots", () => {
    const logs = Array.from({ length: 12 }, (_, index) =>
      log({ day: index + 1, pts: 15 + index * 2 }),
    );
    const values = build({ logs });
    const trend = buildFantasyTrend({
      line: star,
      logs,
      poolStats,
      config,
      methodWeights: {},
      windowGames: null,
    });

    expect(values).toHaveLength(12);
    expect(values.map((value) => value.rollingZ)).toEqual(trend.map((point) => point.z));
    expect(values.map((value) => value.rollingG)).toEqual(trend.map((point) => point.g));
    expect(values[8]?.rollingZ).toBeNull();
  });

  it("breaks each game into its included categories' raw Z, even when one is punted", () => {
    const [game] = build({
      logs: [log({ day: 1, pts: 40 })],
      categories: ["pts", "reb"],
      methodWeights: { z: { pts: 0 } },
    });

    expect(Object.keys(game?.categories ?? {})).toEqual(["pts", "reb"]);
    expect(game?.categories.pts ?? 0).toBeGreaterThan(0);
    // The punt zeroes PTS in the weighted total, leaving REB alone.
    expect(game?.z ?? 0).toBeCloseTo(game?.categories.reb ?? Number.NaN);
  });

  it("totals Z as the sum of its categories when nothing is weighted", () => {
    const [game] = build({ logs: [log({ day: 1 })] });
    const sum = Object.values(game?.categories ?? {}).reduce((total, value) => total + value, 0);

    expect(game?.z ?? Number.NaN).toBeCloseTo(sum);
  });
});
