import { describe, expect, it, vi } from "vitest";

import * as endpoints from "@/lib/balldontlie/endpoints";
import { BdlGame, BdlPlayer, BdlTeam } from "@/lib/balldontlie/schemas";
import * as persist from "@/lib/stats/persist";

import { seedDemo } from "@/lib/demo/seed";

const teams: BdlTeam[] = [
  { id: 18, abbreviation: "MIN", full_name: "Minnesota Timberwolves" },
  { id: 21, abbreviation: "OKC", full_name: "Oklahoma City Thunder" },
  { id: 7, abbreviation: "DAL", full_name: "Dallas Mavericks" },
  { id: 2, abbreviation: "BOS", full_name: "Boston Celtics" },
  { id: 17, abbreviation: "MIL", full_name: "Milwaukee Bucks" },
];

const profiledPlayers: BdlPlayer[] = [
  {
    id: 3547232,
    first_name: "Anthony",
    last_name: "Edwards",
    position: "G",
    jersey_number: "5",
    team: { id: 18, abbreviation: "MIN" },
  },
  {
    id: 3202128,
    first_name: "Shai",
    last_name: "Gilgeous-Alexander",
    position: "G",
    jersey_number: "2",
    team: { id: 21, abbreviation: "OKC" },
  },
  {
    id: 3220,
    first_name: "Luka",
    last_name: "Doncic",
    position: "G",
    jersey_number: "77",
    team: { id: 7, abbreviation: "DAL" },
  },
  {
    id: 4066,
    first_name: "Jayson",
    last_name: "Tatum",
    position: "F",
    jersey_number: "0",
    team: { id: 2, abbreviation: "BOS" },
  },
  {
    id: 15,
    first_name: "Giannis",
    last_name: "Antetokounmpo",
    position: "F",
    jersey_number: "34",
    team: { id: 17, abbreviation: "MIL" },
  },
];

const unprofiledPlayer: BdlPlayer = {
  id: 999999,
  first_name: "Bob",
  last_name: "Extra",
  position: "C",
  jersey_number: "99",
  team: { id: 2, abbreviation: "BOS" },
};

const fakeGames: BdlGame[] = [
  {
    id: 5001,
    date: "2025-10-22",
    season: 2025,
    home_team_id: 18,
    visitor_team_id: 2,
    home_team_score: 100,
    visitor_team_score: 95,
    postseason: false,
  },
  {
    id: 5002,
    date: "2025-10-24",
    season: 2025,
    home_team_id: 2,
    visitor_team_id: 18,
    home_team_score: 90,
    visitor_team_score: 88,
    postseason: false,
  },
  {
    id: 5003,
    date: "2025-10-26",
    season: 2025,
    home_team_id: 18,
    visitor_team_id: 2,
    home_team_score: 101,
    visitor_team_score: 99,
    postseason: false,
  },
];

describe("seedDemo", () => {
  it("fetches teams/players, generates demo game logs per profile, persists, and returns counts", async () => {
    vi.spyOn(endpoints, "fetchTeams").mockResolvedValue(teams);
    vi.spyOn(endpoints, "fetchAllPlayers").mockResolvedValue([
      ...profiledPlayers,
      unprofiledPlayer,
    ]);
    const fetchTeamGames = vi.spyOn(endpoints, "fetchTeamGames").mockResolvedValue(fakeGames);
    const upsertPlayers = vi.spyOn(persist, "upsertPlayers").mockResolvedValue(6);
    const upsertGameLogs = vi.spyOn(persist, "upsertGameLogs").mockResolvedValue(15);
    const upsertSeasonStats = vi.spyOn(persist, "upsertSeasonStats").mockResolvedValue(5);

    const summary = await seedDemo({ apiKey: "k" });

    expect(summary).toEqual({ players: 6, seasonStats: 5, gameLogs: 15 });

    expect(upsertPlayers).toHaveBeenCalledTimes(1);
    const playerInputs = upsertPlayers.mock.calls[0]?.[0] ?? [];
    expect(playerInputs).toHaveLength(6);
    expect(playerInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 3547232, fullName: "Anthony Edwards", teamAbbr: "MIN" }),
        expect.objectContaining({
          id: 3202128,
          fullName: "Shai Gilgeous-Alexander",
          teamAbbr: "OKC",
        }),
        expect.objectContaining({ id: 3220, fullName: "Luka Doncic", teamAbbr: "DAL" }),
        expect.objectContaining({ id: 4066, fullName: "Jayson Tatum", teamAbbr: "BOS" }),
        expect.objectContaining({
          id: 15,
          fullName: "Giannis Antetokounmpo",
          teamAbbr: "MIL",
        }),
        expect.objectContaining({ id: 999999, fullName: "Bob Extra", teamAbbr: "BOS" }),
      ]),
    );

    expect(fetchTeamGames).toHaveBeenCalledTimes(5);
    expect(fetchTeamGames).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 18, throttleMs: 13000 }),
    );

    expect(upsertGameLogs).toHaveBeenCalledTimes(1);
    expect(upsertSeasonStats).toHaveBeenCalledTimes(1);
  });

  it("rejects when a demo profile has no matching player", async () => {
    vi.spyOn(endpoints, "fetchTeams").mockResolvedValue(teams);
    vi.spyOn(endpoints, "fetchAllPlayers").mockResolvedValue(
      profiledPlayers.filter((player) => player.last_name !== "Edwards"),
    );
    vi.spyOn(endpoints, "fetchTeamGames").mockResolvedValue(fakeGames);
    vi.spyOn(persist, "upsertPlayers").mockResolvedValue(4);
    vi.spyOn(persist, "upsertGameLogs").mockResolvedValue(0);
    vi.spyOn(persist, "upsertSeasonStats").mockResolvedValue(0);

    await expect(seedDemo({ apiKey: "k" })).rejects.toThrow("Demo profile not resolvable");
  });

  it("rejects when a matched demo profile player has no team", async () => {
    const edwardsNoTeam: BdlPlayer = {
      ...profiledPlayers[0],
      team: null,
    };
    vi.spyOn(endpoints, "fetchTeams").mockResolvedValue(teams);
    vi.spyOn(endpoints, "fetchAllPlayers").mockResolvedValue([
      edwardsNoTeam,
      ...profiledPlayers.slice(1),
      unprofiledPlayer,
    ]);
    vi.spyOn(endpoints, "fetchTeamGames").mockResolvedValue(fakeGames);
    vi.spyOn(persist, "upsertPlayers").mockResolvedValue(6);
    vi.spyOn(persist, "upsertGameLogs").mockResolvedValue(0);
    vi.spyOn(persist, "upsertSeasonStats").mockResolvedValue(0);

    await expect(seedDemo({ apiKey: "k" })).rejects.toThrow(
      "Demo profile not resolvable: Anthony Edwards",
    );
  });
});
