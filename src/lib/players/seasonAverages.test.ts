import { describe, expect, it } from "vitest";

import {
  aggregateCareerTotals,
  buildCareerAverageLine,
  buildSeasonAverageLine,
  type SeasonStatTotals,
} from "@/lib/players/seasonAverages";

const buildRow = (
  overrides: Partial<SeasonStatTotals> & { playerId: number },
): SeasonStatTotals => ({
  gamesPlayed: 50,
  minutes: 1500,
  fgm: 400,
  fga: 800,
  fg3m: 100,
  fg3a: 250,
  ftm: 150,
  fta: 200,
  reb: 250,
  ast: 300,
  stl: 60,
  blk: 40,
  tov: 110,
  pts: 1000,
  ...overrides,
});

describe("buildSeasonAverageLine", () => {
  it("returns null when the player has no season row", () => {
    expect(buildSeasonAverageLine({ rows: [buildRow({ playerId: 2 })], playerId: 1 })).toBeNull();
  });

  it("computes per-game averages and shooting percentages", () => {
    const line = buildSeasonAverageLine({ rows: [buildRow({ playerId: 1 })], playerId: 1 });

    const byKey = new Map(line?.map((stat) => [stat.key, stat.value]));
    expect(byKey.get("pts")).toBe("20.0");
    expect(byKey.get("ast")).toBe("6.0");
    expect(byKey.get("min")).toBe("30.0");
    expect(byKey.get("fgPct")).toBe("50.0%");
    expect(byKey.get("fg3Pct")).toBe("40.0%");
    expect(byKey.get("ftPct")).toBe("75.0%");
  });

  it("ranks against qualified players with ties sharing a rank", () => {
    const rows = [
      buildRow({ playerId: 1, pts: 1000 }),
      buildRow({ playerId: 2, pts: 1500 }),
      buildRow({ playerId: 3, pts: 1000 }),
      buildRow({ playerId: 4, pts: 500 }),
    ];

    const line = buildSeasonAverageLine({ rows, playerId: 1 });
    const pts = line?.find((stat) => stat.key === "pts");

    expect(pts?.rank).toBe(2);
    expect(pts?.eligibleCount).toBe(4);
  });

  it("excludes players under the games floor from the ranking pool", () => {
    const rows = [
      buildRow({ playerId: 1, pts: 1000 }),
      // 40 points in a single game: a small-sample outlier that must not rank.
      buildRow({ playerId: 2, gamesPlayed: 1, pts: 40 }),
    ];

    const line = buildSeasonAverageLine({ rows, playerId: 1 });
    const pts = line?.find((stat) => stat.key === "pts");

    expect(pts?.rank).toBe(1);
    expect(pts?.eligibleCount).toBe(1);
  });

  it("applies attempt floors to shooting percentage ranks", () => {
    const rows = [
      buildRow({ playerId: 1 }),
      // 5-of-5 from the field but nowhere near the FGA qualifier.
      buildRow({ playerId: 2, fgm: 5, fga: 5 }),
    ];

    const line = buildSeasonAverageLine({ rows, playerId: 1 });
    const fgPct = line?.find((stat) => stat.key === "fgPct");

    expect(fgPct?.rank).toBe(1);
    expect(fgPct?.eligibleCount).toBe(1);
  });

  it("still ranks the viewed player against the pool when they miss the floor", () => {
    const rows = [
      buildRow({ playerId: 1, gamesPlayed: 5, pts: 100 }),
      buildRow({ playerId: 2, pts: 1500 }),
    ];

    const line = buildSeasonAverageLine({ rows, playerId: 1 });
    const pts = line?.find((stat) => stat.key === "pts");

    // 20.0 per game vs the qualified 30.0 per game
    expect(pts?.rank).toBe(2);
    expect(pts?.eligibleCount).toBe(1);
  });

  it("marks turnovers as neutral and scoring stats as leader ranks", () => {
    const line = buildSeasonAverageLine({ rows: [buildRow({ playerId: 1 })], playerId: 1 });

    expect(line?.find((stat) => stat.key === "tov")?.rankTone).toBe("neutral");
    expect(line?.find((stat) => stat.key === "pts")?.rankTone).toBe("leader");
  });

  it("drops percentage stats the player has no attempts for", () => {
    const line = buildSeasonAverageLine({
      rows: [buildRow({ playerId: 1, fg3m: 0, fg3a: 0 })],
      playerId: 1,
    });

    expect(line?.some((stat) => stat.key === "fg3Pct")).toBe(false);
    expect(line?.some((stat) => stat.key === "pts")).toBe(true);
  });
});

describe("aggregateCareerTotals", () => {
  it("returns null when the player has no season rows", () => {
    expect(aggregateCareerTotals({ rows: [buildRow({ playerId: 2 })], playerId: 1 })).toBeNull();
  });

  it("sums only the player's own rows across seasons", () => {
    const totals = aggregateCareerTotals({
      rows: [
        buildRow({ playerId: 1, gamesPlayed: 50, pts: 1000, fgm: 400, fga: 800 }),
        buildRow({ playerId: 1, gamesPlayed: 30, pts: 600, fgm: 200, fga: 500 }),
        buildRow({ playerId: 2, gamesPlayed: 82, pts: 2000 }),
      ],
      playerId: 1,
    });

    expect(totals?.gamesPlayed).toBe(80);
    expect(totals?.pts).toBe(1600);
    expect(totals?.fgm).toBe(600);
    expect(totals?.fga).toBe(1300);
  });
});

describe("buildCareerAverageLine", () => {
  it("formats per-game and percentage career values with no leaderboard rank", () => {
    // 1600 pts / 80 games = 20.0; 600/1300 FG = 46.2%.
    const totals = aggregateCareerTotals({
      rows: [
        buildRow({ playerId: 1, gamesPlayed: 50, pts: 1000, fgm: 400, fga: 800 }),
        buildRow({ playerId: 1, gamesPlayed: 30, pts: 600, fgm: 200, fga: 500 }),
      ],
      playerId: 1,
    });
    const line = buildCareerAverageLine({ totals: totals ?? buildRow({ playerId: 1 }) });

    const byKey = new Map(line.map((stat) => [stat.key, stat.value]));
    expect(byKey.get("pts")).toBe("20.0");
    expect(byKey.get("fgPct")).toBe("46.2%");
    expect(line.every((stat) => stat.rank === null)).toBe(true);
  });
});
