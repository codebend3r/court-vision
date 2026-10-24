import { describe, expect, it } from "bun:test";

import {
  FIXTURE_GAME_COUNT,
  FIXTURE_GAME_LOG_ROWS,
  FIXTURE_PLAYER_COUNT,
  FIXTURE_PLAYERS,
  FIXTURE_PROFILE_PLAYER,
  FIXTURE_SOURCE_LOGS,
} from "@/lib/players/fixture";

describe("player fixtures", () => {
  it("holds exactly 100 players with unique ids and names", () => {
    expect(FIXTURE_PLAYERS).toHaveLength(FIXTURE_PLAYER_COUNT);
    expect(new Set(FIXTURE_PLAYERS.map((player) => player.id)).size).toBe(FIXTURE_PLAYER_COUNT);
    expect(new Set(FIXTURE_PLAYERS.map((player) => player.fullName)).size).toBe(
      FIXTURE_PLAYER_COUNT,
    );
  });

  it("lists players by points, highest first", () => {
    const points = FIXTURE_PLAYERS.map(({ stats }) => stats.pts / stats.gamesPlayed);
    expect(points[0]).toBeGreaterThan(points[points.length - 1] ?? 0);
  });

  it("makes the profile player the first list row", () => {
    expect(FIXTURE_PROFILE_PLAYER).toEqual(FIXTURE_PLAYERS[0]);
  });

  it("builds 60 consistent games for both consumers", () => {
    expect(FIXTURE_GAME_LOG_ROWS).toHaveLength(FIXTURE_GAME_COUNT);
    expect(FIXTURE_SOURCE_LOGS).toHaveLength(FIXTURE_GAME_COUNT);
    expect(FIXTURE_GAME_LOG_ROWS.every((row) => row.fgm <= row.fga && row.fg3m <= row.fgm)).toBe(
      true,
    );
    expect(FIXTURE_GAME_LOG_ROWS.every((row) => row.reb === row.oreb + row.dreb)).toBe(true);
  });

  it("is deterministic", () => {
    expect(FIXTURE_GAME_LOG_ROWS[0]?.gameDate).toBe("2026-10-22T00:00:00.000Z");
  });
});
