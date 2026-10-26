import { describe, expect, it } from "bun:test";

import { type PlayerPoolRow } from "@/lib/players/search";
import { type AdvancedPlayerRow } from "@/lib/players/searchAdvanced";
import { advancedSpecs, regularSpecs } from "@/lib/roster/statSpecs";

const identity = {
  id: 1,
  firstName: "A",
  lastName: "B",
  fullName: "A B",
  teamAbbr: null,
  position: null,
  nbaPersonId: null,
};

type PoolProps = { gamesPlayed: number; fga: number };

const pool = ({ gamesPlayed, fga }: PoolProps): PlayerPoolRow => ({
  ...identity,
  stats: {
    gamesPlayed,
    min: 0,
    fgm: 5,
    fga,
    fg3m: 2,
    fg3a: 4,
    ftm: 3,
    fta: 4,
    reb: 40,
    ast: 20,
    stl: 4,
    blk: 2,
    tov: 10,
    pts: 100,
  },
});

type SpecProps = { key: string; mode: "average" | "total" };

const spec = ({ key, mode }: SpecProps) => {
  const found = regularSpecs({ mode }).find((entry) => entry.key === key);
  if (found === undefined) throw new Error(`no spec ${key}`);
  return found;
};

describe("regularSpecs", () => {
  it("reads counting stats per game by default", () => {
    const pts = spec({ key: "pts", mode: "average" });
    expect(pts.valueOf(pool({ gamesPlayed: 4, fga: 10 }))).toBe(25);
    expect(pts.format(25)).toBe("25.0");
  });

  it("reads totals in total mode", () => {
    const pts = spec({ key: "pts", mode: "total" });
    expect(pts.valueOf(pool({ gamesPlayed: 4, fga: 10 }))).toBe(100);
    expect(pts.format(100)).toBe("100");
  });

  it("has no per-game value for a player with no games", () => {
    expect(spec({ key: "pts", mode: "average" }).valueOf(pool({ gamesPlayed: 0, fga: 10 }))).toBe(
      null,
    );
  });

  it("reads shooting as a rate, and nothing without attempts", () => {
    const fg = spec({ key: "fgPct", mode: "average" });
    expect(fg.valueOf(pool({ gamesPlayed: 4, fga: 10 }))).toBe(0.5);
    expect(fg.valueOf(pool({ gamesPlayed: 4, fga: 0 }))).toBe(null);
    expect(fg.format(0.5)).toBe(".500");
  });

  it("is the only counting stat where less is better", () => {
    const lower = regularSpecs({ mode: "average" })
      .filter((entry) => entry.direction === "low")
      .map((entry) => entry.key);
    expect(lower).toEqual(["tov"]);
  });
});

describe("advancedSpecs", () => {
  const advancedRow = (): AdvancedPlayerRow => ({
    ...identity,
    stats: {
      gamesWithData: 5,
      pie: 0.15,
      pace: 99,
      assistPercentage: null,
      assistRatio: 10,
      assistToTurnover: 2,
      defensiveRating: 108,
      defensiveReboundPercentage: 0.2,
      effectiveFieldGoalPercentage: 0.55,
      netRating: 3,
      offensiveRating: 115,
      offensiveReboundPercentage: 0.05,
      reboundPercentage: 0.1,
      trueShootingPercentage: 0.6,
      turnoverRatio: 12,
      usagePercentage: 0.22,
    },
  });

  it("has a spec for every advanced metric", () => {
    expect(advancedSpecs()).toHaveLength(15);
  });

  it("reads each metric off the row, null stays null", () => {
    const byKey = new Map(advancedSpecs().map((entry) => [entry.key, entry]));
    expect(byKey.get("pie")?.valueOf(advancedRow())).toBe(0.15);
    expect(byKey.get("assistPercentage")?.valueOf(advancedRow())).toBe(null);
  });

  it("formats a share like FG% and a rating to one decimal", () => {
    const byKey = new Map(advancedSpecs().map((entry) => [entry.key, entry]));
    expect(byKey.get("pie")?.format(0.15)).toBe(".150");
    expect(byKey.get("offensiveRating")?.format(115)).toBe("115.0");
  });

  it("marks pace and usage neutral, and defence and turnovers lower-is-better", () => {
    const direction = Object.fromEntries(
      advancedSpecs().map((entry) => [entry.key, entry.direction]),
    );
    expect(direction).toMatchObject({
      pace: "neutral",
      usagePercentage: "neutral",
      defensiveRating: "low",
      turnoverRatio: "low",
      pie: "high",
    });
  });
});
