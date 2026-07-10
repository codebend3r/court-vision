import { describe, expect, it } from "vitest";

import { BdlGame } from "@/lib/balldontlie/schemas";

import { generateGameLogs } from "./generate";
import { DEMO_PROFILES } from "./profiles";

const TEAM_ID = 18;
const OPPONENT_ID = 2;
const teamAbbrById = new Map<number, string>([
  [TEAM_ID, "MIN"],
  [OPPONENT_ID, "BOS"],
]);

const buildGames = (count: number): BdlGame[] =>
  Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(2025, 9, 22 + i));
    const isHome = i % 2 === 0;
    return {
      id: 1000 + i,
      date: date.toISOString().slice(0, 10),
      season: 2025,
      home_team_id: isHome ? TEAM_ID : OPPONENT_ID,
      visitor_team_id: isHome ? OPPONENT_ID : TEAM_ID,
      home_team_score: 100 + (i % 15),
      visitor_team_score: 95 + (i % 10),
      postseason: false,
    };
  });

const edwardsProfile = DEMO_PROFILES[0];

const baseArgs = {
  playerId: 3547232,
  teamId: TEAM_ID,
  teamAbbr: "MIN",
  profile: edwardsProfile,
  teamAbbrById,
};

describe("generateGameLogs", () => {
  it("is deterministic for identical args", () => {
    const games = buildGames(82);
    const first = generateGameLogs({ ...baseArgs, games });
    const second = generateGameLogs({ ...baseArgs, games });
    expect(second).toEqual(first);
  });

  it("returns exactly profile.gamesPlayed rows", () => {
    const games = buildGames(82);
    const logs = generateGameLogs({ ...baseArgs, games });
    expect(logs).toHaveLength(edwardsProfile.gamesPlayed);
  });

  it("produces internally consistent box-score rows", () => {
    const games = buildGames(82);
    const logs = generateGameLogs({ ...baseArgs, games });

    logs.forEach((row) => {
      expect(row.pts).toBe(2 * (row.fgm - row.fg3m) + 3 * row.fg3m + row.ftm);
      expect(row.reb).toBe(row.oreb + row.dreb);
      expect(row.fgm).toBeGreaterThanOrEqual(row.fg3m);
      expect(row.fga).toBeGreaterThanOrEqual(row.fgm);
      expect(row.fg3a).toBeGreaterThanOrEqual(row.fg3m);
      expect(row.fta).toBeGreaterThanOrEqual(row.ftm);
      [
        row.minutes,
        row.fgm,
        row.fga,
        row.fg3m,
        row.fg3a,
        row.ftm,
        row.fta,
        row.oreb,
        row.dreb,
        row.reb,
        row.ast,
        row.stl,
        row.blk,
        row.tov,
        row.pts,
      ].forEach((value) => expect(value).toBeGreaterThanOrEqual(0));
      expect(row.season).toBe("2025-26");
    });
  });

  it("sorts rows by gameDate ascending", () => {
    const games = buildGames(82);
    const logs = generateGameLogs({ ...baseArgs, games });
    const sorted = [...logs].sort((a, b) => a.gameDate.getTime() - b.gameDate.getTime());
    expect(logs).toEqual(sorted);
  });

  it("excludes unplayed (0-0) games", () => {
    const games = buildGames(82);
    const withUnplayed: BdlGame[] = [
      ...games,
      {
        id: 9001,
        date: "2026-04-13",
        season: 2025,
        home_team_id: TEAM_ID,
        visitor_team_id: OPPONENT_ID,
        home_team_score: 0,
        visitor_team_score: 0,
        postseason: false,
      },
      {
        id: 9002,
        date: "2026-04-14",
        season: 2025,
        home_team_id: OPPONENT_ID,
        visitor_team_id: TEAM_ID,
        home_team_score: 0,
        visitor_team_score: 0,
        postseason: false,
      },
    ];

    const baseline = generateGameLogs({ ...baseArgs, games });
    const withZeros = generateGameLogs({ ...baseArgs, games: withUnplayed });
    expect(withZeros).toHaveLength(baseline.length);
  });

  it("keeps mean points within +/-20% of the profile's expected scoring", () => {
    const games = buildGames(82);
    const logs = generateGameLogs({ ...baseArgs, games });
    const meanPts = logs.reduce((total, row) => total + row.pts, 0) / logs.length;
    expect(meanPts).toBeGreaterThan(27.6 * 0.8);
    expect(meanPts).toBeLessThan(27.6 * 1.2);
  });
});
