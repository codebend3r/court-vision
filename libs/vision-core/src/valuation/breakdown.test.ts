import { describe, expect, it } from "bun:test";

import {
  buildCategoryBreakdown,
  type Category,
  CATEGORY_KEYS,
  computePoolStats,
  DEFAULT_POINTS_SCORING,
  makeStatLine,
  type ValuationConfig,
} from "#core/testing/basketball";

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

// Well above the pool in every counting category, with a heavy turnover line.
const star = makeStatLine({
  playerId: 7,
  pts: 1500,
  reb: 450,
  ast: 450,
  stl: 80,
  blk: 30,
  fg3m: 200,
  tov: 200,
  fgm: 500,
  fga: 1000,
  ftm: 440,
  fta: 500,
});

const lines = [star, ...Array.from({ length: 20 }, (_, index) => poolLine(index))];
const poolStats = computePoolStats({ lines, basis: "perGame", poolSize: 150, windowGames: null });
const config: ValuationConfig = {
  categories: [...CATEGORY_KEYS],
  weights: {},
  basis: "perGame",
  teams: 12,
  rosterSlots: 13,
  scoring: DEFAULT_POINTS_SCORING,
};

const entryFor = ({
  breakdown,
  key,
}: {
  breakdown: ReturnType<typeof buildCategoryBreakdown>;
  key: Category;
}) => {
  const entry = breakdown.find((candidate) => candidate.key === key);
  if (entry === undefined) throw new Error(`no ${key} entry`);
  return entry;
};

describe("buildCategoryBreakdown", () => {
  it("lists every included category in table order beside its per-game line", () => {
    const breakdown = buildCategoryBreakdown({ line: star, poolStats, config, methodWeights: {} });

    expect(breakdown.map((entry) => entry.key)).toEqual([...CATEGORY_KEYS]);
    const pts = entryFor({ breakdown, key: "pts" });
    expect(pts.label).toBe("PTS");
    expect(pts.kind).toBe("counting");
    expect(pts.perGame).toBeCloseTo(30);
    expect(pts.z).toBeGreaterThan(0);
    expect(pts.g).toBeGreaterThan(0);
  });

  it("omits excluded categories", () => {
    const breakdown = buildCategoryBreakdown({
      line: star,
      poolStats,
      config: { ...config, categories: ["pts", "reb"] },
      methodWeights: {},
    });

    expect(breakdown.map((entry) => entry.key)).toEqual(["pts", "reb"]);
  });

  it("reports raw scores, so a punted category still shows what is given up", () => {
    const unweighted = buildCategoryBreakdown({ line: star, poolStats, config, methodWeights: {} });
    const punted = buildCategoryBreakdown({
      line: star,
      poolStats,
      config,
      methodWeights: { z: { pts: 0 }, g: { pts: 0 } },
    });

    expect(entryFor({ breakdown: punted, key: "pts" }).z).toBe(
      entryFor({ breakdown: unweighted, key: "pts" }).z,
    );
    expect(entryFor({ breakdown: punted, key: "pts" }).g).toBe(
      entryFor({ breakdown: unweighted, key: "pts" }).g,
    );
  });

  it("sign-corrects turnovers while keeping the per-game count positive", () => {
    const breakdown = buildCategoryBreakdown({ line: star, poolStats, config, methodWeights: {} });
    const tov = entryFor({ breakdown, key: "tov" });

    expect(tov.z).toBeLessThan(0);
    expect(tov.g).toBeLessThan(0);
    expect(tov.perGame).toBeCloseTo(4);
  });

  it("shows ratio categories as the make rate", () => {
    const breakdown = buildCategoryBreakdown({ line: star, poolStats, config, methodWeights: {} });
    const ft = entryFor({ breakdown, key: "ft" });

    expect(ft.kind).toBe("ratio");
    expect(ft.perGame).toBeCloseTo(0.88);
  });
});
