import { describe, expect, it } from "vitest";

import {
  buildTeamStats,
  ordinal,
  rankTeams,
  type TeamBoxTotals,
  type TeamGameResult,
} from "@/lib/teams/stats";

const box = (overrides: Partial<TeamBoxTotals> & { teamAbbr: string }): TeamBoxTotals => ({
  pts: 200,
  reb: 80,
  ast: 50,
  stl: 15,
  blk: 10,
  tov: 25,
  fg3m: 20,
  fgm: 80,
  fga: 160,
  ftm: 20,
  fta: 25,
  ...overrides,
});

const game = (
  overrides: Partial<TeamGameResult> & { teamAbbr: string; gameId: string },
): TeamGameResult => ({
  teamScore: 110,
  opponentScore: 100,
  winLoss: "W",
  ...overrides,
});

describe("buildTeamStats", () => {
  const results = [
    game({ teamAbbr: "TOR", gameId: "g1" }),
    game({ teamAbbr: "TOR", gameId: "g2", teamScore: 90, opponentScore: 120, winLoss: "L" }),
    game({ teamAbbr: "BOS", gameId: "g1", teamScore: 100, opponentScore: 110, winLoss: "L" }),
  ];
  const totals = [box({ teamAbbr: "TOR" }), box({ teamAbbr: "BOS", pts: 100, fga: 0, fta: 0 })];

  it("computes record, scoring, and per-game rates from team games", () => {
    const stats = buildTeamStats({ results, totals });
    const toronto = stats.find((team) => team.abbr === "TOR");
    expect(toronto?.games).toBe(2);
    expect(toronto?.wins).toBe(1);
    expect(toronto?.losses).toBe(1);
    expect(toronto?.winPct).toBeCloseTo(0.5, 10);
    expect(toronto?.ppg).toBeCloseTo(100, 10); // (110 + 90) / 2
    expect(toronto?.oppPpg).toBeCloseTo(110, 10);
    expect(toronto?.diff).toBeCloseTo(-10, 10);
    expect(toronto?.rpg).toBeCloseTo(40, 10);
    expect(toronto?.fgPct).toBeCloseTo(0.5, 10);
  });

  it("guards zero-attempt percentages", () => {
    const stats = buildTeamStats({ results, totals });
    const boston = stats.find((team) => team.abbr === "BOS");
    expect(boston?.fgPct).toBe(0);
    expect(boston?.ftPct).toBe(0);
  });
});

describe("rankTeams", () => {
  const stats = buildTeamStats({
    results: [
      game({ teamAbbr: "AAA", gameId: "g1", teamScore: 120, opponentScore: 100 }),
      game({ teamAbbr: "BBB", gameId: "g1", teamScore: 100, opponentScore: 120, winLoss: "L" }),
      game({ teamAbbr: "CCC", gameId: "g2", teamScore: 110, opponentScore: 105 }),
    ],
    totals: [
      box({ teamAbbr: "AAA", tov: 10 }),
      box({ teamAbbr: "BBB", tov: 30 }),
      box({ teamAbbr: "CCC", tov: 10 }),
    ],
  });
  const ranks = rankTeams({ stats });

  it("ranks descending by default", () => {
    expect(ranks.get("AAA")?.ppg).toBe(1);
    expect(ranks.get("BBB")?.ppg).toBe(3);
  });

  it("ranks ascending when lower is better and shares tied ranks", () => {
    expect(ranks.get("AAA")?.topg).toBe(1);
    expect(ranks.get("CCC")?.topg).toBe(1); // tied at 10 per game
    expect(ranks.get("BBB")?.topg).toBe(3);
    expect(ranks.get("AAA")?.oppPpg).toBe(1); // fewest points allowed
  });
});

describe("ordinal", () => {
  it("formats English ordinals including the teens", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(30)).toBe("30th");
  });
});
