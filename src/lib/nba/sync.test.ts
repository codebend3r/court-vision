import { describe, expect, it, vi } from "vitest";

import * as endpoints from "./endpoints";
import * as persist from "./persist";
import { syncNba } from "./sync";

const playerIndexRow = {
  PERSON_ID: 1629029,
  PLAYER_FIRST_NAME: "Luka",
  PLAYER_LAST_NAME: "Doncic",
  TEAM_ID: 1610612747,
  TEAM_ABBREVIATION: "LAL",
  POSITION: "G-F",
  JERSEY_NUMBER: "77",
};

describe("syncNba", () => {
  it("fetches, transforms, persists, and aggregates counts across month chunks", async () => {
    vi.spyOn(endpoints, "fetchPlayerIndex").mockResolvedValue([playerIndexRow]);
    vi.spyOn(endpoints, "fetchSeasonStats").mockResolvedValue([]);
    vi.spyOn(endpoints, "fetchPlayerGameLogs").mockResolvedValue([]);

    const upsertPlayers = vi.spyOn(persist, "upsertPlayers").mockResolvedValue(1);
    const upsertSeasonStats = vi.spyOn(persist, "upsertSeasonStats").mockResolvedValue(0);
    const upsertGameLogs = vi.spyOn(persist, "upsertGameLogs").mockResolvedValue(0);

    const summary = await syncNba();

    expect(summary).toEqual({ players: 1, seasonStats: 0, gameLogs: 0 });
    expect(upsertPlayers).toHaveBeenCalledWith([
      {
        id: 1629029,
        firstName: "Luka",
        lastName: "Doncic",
        fullName: "Luka Doncic",
        teamId: 1610612747,
        teamAbbr: "LAL",
        position: "G-F",
        jerseyNumber: "77",
      },
    ]);
    expect(upsertSeasonStats).toHaveBeenCalledTimes(1);
    // one game-log fetch + upsert per month range (7)
    expect(endpoints.fetchPlayerGameLogs).toHaveBeenCalledTimes(7);
    expect(upsertGameLogs).toHaveBeenCalledTimes(7);
  });
});
