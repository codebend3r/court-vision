import { describe, expect, it } from "bun:test";

import {
  aggregateCareerTotals,
  buildCareerAverageLine,
  buildSeasonAverageLine,
  qualifyingFloors,
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
    expect(byKey.get("min")).toBe("30");
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

// Two games into a season: nobody has played 20 games or made 300 field goals.
describe("early in a season", () => {
  const twoGames = (
    overrides: Partial<SeasonStatTotals> & { playerId: number },
  ): SeasonStatTotals =>
    buildRow({
      gamesPlayed: 2,
      minutes: 66,
      fgm: 14,
      fga: 35,
      fg3m: 3,
      fg3a: 14,
      ftm: 6,
      fta: 8,
      reb: 10,
      ast: 1,
      stl: 4,
      blk: 3,
      tov: 12,
      pts: 37,
      ...overrides,
    });

  const rows = [
    twoGames({ playerId: 1 }),
    twoGames({ playerId: 2, pts: 60, fgm: 22, ftm: 12, fta: 12 }),
    twoGames({ playerId: 3, pts: 20, fgm: 8, ftm: 2, fta: 4 }),
  ];

  const rankOf = ({ playerId, key }: { playerId: number; key: string }) =>
    buildSeasonAverageLine({ rows, playerId })?.find((stat) => stat.key === key);

  it("does not call the only player in the room first in the league", () => {
    // The bug: with a fixed 20-game floor nobody qualified, so the viewed
    // player ranked 1st against an empty board in every stat.
    const stats = buildSeasonAverageLine({ rows, playerId: 1 }) ?? [];
    expect(stats.length).toBeGreaterThan(0);
    expect(stats.every((stat) => stat.eligibleCount > 0)).toBe(true);
  });

  it("ranks against the players who have played as much, by points", () => {
    expect(rankOf({ playerId: 2, key: "pts" })).toMatchObject({ rank: 1, eligibleCount: 3 });
    expect(rankOf({ playerId: 1, key: "pts" })).toMatchObject({ rank: 2, eligibleCount: 3 });
    expect(rankOf({ playerId: 3, key: "pts" })).toMatchObject({ rank: 3, eligibleCount: 3 });
  });

  it("ranks the shooting percentages against a made-volume floor scaled to the games played", () => {
    expect(rankOf({ playerId: 2, key: "ftPct" })).toMatchObject({ rank: 1 });
    expect(rankOf({ playerId: 1, key: "ftPct" })?.rank).toBeGreaterThan(1);
  });

  it("leaves a player with far fewer games than the busiest player out of the pool", () => {
    const withCallUp = [...rows, twoGames({ playerId: 4, gamesPlayed: 1, pts: 25, minutes: 30 })];
    const line = buildSeasonAverageLine({ rows: withCallUp, playerId: 4 });
    const pts = line?.find((stat) => stat.key === "pts");
    // One game is under 70% of the busiest player's two, so not eligible
    // himself, though still placed among those who are.
    expect(pts?.eligibleCount).toBe(3);
    expect(pts?.rank).toBe(2);
  });

  it("leaves a stat unranked when nobody has the volume for it", () => {
    const noShooters = rows.map((row) => ({ ...row, ftm: 0, fta: 0 }));
    const line = buildSeasonAverageLine({ rows: noShooters, playerId: 1 });
    expect(line?.find((stat) => stat.key === "ftPct")).toBeUndefined();
  });
});

describe("qualifyingFloors", () => {
  const withGames = (gamesPlayed: number): SeasonStatTotals[] => [
    buildRow({ playerId: 1, gamesPlayed }),
  ];

  it("asks for the full season's floors once a full season is played", () => {
    expect(qualifyingFloors({ rows: withGames(82) })).toEqual({
      games: 20,
      fgm: 300,
      fg3m: 82,
      ftm: 125,
    });
    expect(qualifyingFloors({ rows: withGames(90) }).fgm).toBe(300);
  });

  it("scales every floor to the share of the season played", () => {
    expect(qualifyingFloors({ rows: withGames(41) })).toEqual({
      games: 20,
      fgm: 150,
      fg3m: 41,
      ftm: 63,
    });
  });

  it("asks for 70% of the busiest player's games early on, never fewer than one", () => {
    expect(qualifyingFloors({ rows: withGames(2) }).games).toBe(2);
    expect(qualifyingFloors({ rows: withGames(10) }).games).toBe(7);
    expect(qualifyingFloors({ rows: withGames(1) }).games).toBe(1);
  });

  it("asks for at least one game and one make from an empty pool", () => {
    expect(qualifyingFloors({ rows: [] })).toEqual({ games: 1, fgm: 1, fg3m: 1, ftm: 1 });
  });
});
