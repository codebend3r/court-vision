import { beforeEach, describe, expect, it, vi } from "bun:test";

const findMany = vi.fn();
const leagueFindUnique = vi.fn();
const leagueTeamFindFirst = vi.fn();
const getActiveLeagueRecord = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leagueTeamSlot: { findMany },
    league: { findUnique: leagueFindUnique },
    leagueTeam: { findFirst: leagueTeamFindFirst },
  },
}));
vi.mock("@/lib/leagues/queries", () => ({ getActiveLeagueRecord }));

import {
  getLeagueTeamBySlug,
  getLeagueTeams,
  getRosteredPlayerIds,
  TEAM_INCLUDE,
} from "@/lib/leagues/teamQueries";

const league = { id: "league-1", provider: "manual", myTeamId: null };

const durant = {
  id: 7,
  firstName: "Kevin",
  lastName: "Durant",
  fullName: "Kevin Durant",
  teamAbbr: "HOU",
  position: "F",
  nbaPersonId: 201142,
};

const teamRow = ({ id, name, createdAt }: { id: string; name: string; createdAt: string }) => ({
  id,
  name,
  slug: id,
  logoUrl: null,
  managerName: null,
  createdAt: new Date(createdAt),
  slots: [
    { slotType: "PG", externalPlayerName: null, player: durant },
    { slotType: "UTIL", externalPlayerName: null, player: null },
  ],
});

beforeEach(() => {
  findMany.mockReset();
  leagueFindUnique.mockReset();
  leagueTeamFindFirst.mockReset();
  getActiveLeagueRecord.mockReset();
  getActiveLeagueRecord.mockResolvedValue(league);
});

describe("getRosteredPlayerIds", () => {
  it("returns each filled slot's player once, across every team in the active league", async () => {
    findMany.mockResolvedValue([{ playerId: 115 }, { playerId: 237 }]);

    expect(await getRosteredPlayerIds()).toEqual([115, 237]);
    expect(findMany).toHaveBeenCalledWith({
      where: { team: { leagueId: "league-1" }, playerId: { not: null } },
      distinct: ["playerId"],
      select: { playerId: true },
    });
  });

  it("counts only my team's players as rostered in an imported league", async () => {
    getActiveLeagueRecord.mockResolvedValue({
      id: "league-1",
      provider: "yahoo",
      myTeamId: "team-3",
    });
    findMany.mockResolvedValue([{ playerId: 115 }]);

    expect(await getRosteredPlayerIds()).toEqual([115]);
    expect(findMany).toHaveBeenCalledWith({
      where: { teamId: "team-3", playerId: { not: null } },
      distinct: ["playerId"],
      select: { playerId: true },
    });
  });

  it("treats an unknown provider as imported, rostering only my team", async () => {
    getActiveLeagueRecord.mockResolvedValue({
      id: "league-1",
      provider: "espn",
      myTeamId: "team-3",
    });
    findMany.mockResolvedValue([{ playerId: 115 }]);

    expect(await getRosteredPlayerIds()).toEqual([115]);
    expect(findMany).toHaveBeenCalledWith({
      where: { teamId: "team-3", playerId: { not: null } },
      distinct: ["playerId"],
      select: { playerId: true },
    });
  });

  it("counts nobody as rostered in an imported league without my team", async () => {
    getActiveLeagueRecord.mockResolvedValue({ id: "league-1", provider: "yahoo", myTeamId: null });

    expect(await getRosteredPlayerIds()).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("drops a null player id the filter should already have excluded", async () => {
    findMany.mockResolvedValue([{ playerId: 115 }, { playerId: null }]);

    expect(await getRosteredPlayerIds()).toEqual([115]);
  });

  it("returns an empty list without a league, without querying slots", async () => {
    getActiveLeagueRecord.mockResolvedValue(null);

    expect(await getRosteredPlayerIds()).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("getLeagueTeams", () => {
  it("reads the teams with the league's provider and my team in one query", async () => {
    leagueFindUnique.mockResolvedValue({ provider: "manual", myTeamId: null, teams: [] });

    await getLeagueTeams({ leagueId: "league-1" });

    expect(leagueFindUnique).toHaveBeenCalledWith({
      where: { id: "league-1" },
      select: {
        provider: true,
        myTeamId: true,
        teams: { orderBy: { createdAt: "asc" }, include: TEAM_INCLUDE },
      },
    });
  });

  it("marks my team and lists unmatched players by slot", async () => {
    const rival = teamRow({ id: "team-1", name: "Rivals", createdAt: "2026-10-01" });
    const mine = {
      ...teamRow({ id: "team-3", name: "Mine", createdAt: "2026-10-03" }),
      logoUrl: "https://yahoo.example/logo.png",
      managerName: "CJ",
      slots: [
        { slotType: "PG", externalPlayerName: null, player: durant },
        { slotType: "UTIL", externalPlayerName: "Unknown Rookie", player: null },
        { slotType: "UTIL", externalPlayerName: null, player: null },
      ],
    };
    leagueFindUnique.mockResolvedValue({
      provider: "yahoo",
      myTeamId: "team-3",
      teams: [rival, mine],
    });

    const teams = await getLeagueTeams({ leagueId: "league-1" });

    expect(teams.map((team) => team.id)).toEqual(["team-3", "team-1"]);
    expect(teams[0]).toMatchObject({
      isMine: true,
      isImported: true,
      logoUrl: "https://yahoo.example/logo.png",
      managerName: "CJ",
      unmatchedBySlotId: { "UTIL-1": "Unknown Rookie" },
    });
    expect(teams[1]).toMatchObject({ isMine: false, isImported: true, unmatchedBySlotId: {} });
  });

  it("keeps a hand-built league's teams in creation order, none of them mine or imported", async () => {
    leagueFindUnique.mockResolvedValue({
      provider: "manual",
      myTeamId: null,
      teams: [
        teamRow({ id: "team-1", name: "First", createdAt: "2026-10-01" }),
        teamRow({ id: "team-2", name: "Second", createdAt: "2026-10-02" }),
      ],
    });

    const teams = await getLeagueTeams({ leagueId: "league-1" });

    expect(teams.map((team) => team.id)).toEqual(["team-1", "team-2"]);
    expect(teams.every((team) => !team.isMine && !team.isImported)).toBe(true);
  });

  it("treats an unknown provider's teams as imported", async () => {
    leagueFindUnique.mockResolvedValue({
      provider: "espn",
      myTeamId: null,
      teams: [teamRow({ id: "team-1", name: "First", createdAt: "2026-10-01" })],
    });

    const teams = await getLeagueTeams({ leagueId: "league-1" });

    expect(teams[0]).toMatchObject({ isMine: false, isImported: true });
  });

  it("returns no teams for a missing league", async () => {
    leagueFindUnique.mockResolvedValue(null);

    expect(await getLeagueTeams({ leagueId: "gone" })).toEqual([]);
  });
});

describe("getLeagueTeamBySlug", () => {
  it("marks the team mine and imported from its league", async () => {
    leagueTeamFindFirst.mockResolvedValue({
      ...teamRow({ id: "team-3", name: "Mine", createdAt: "2026-10-03" }),
      league: { provider: "yahoo", myTeamId: "team-3" },
    });

    const team = await getLeagueTeamBySlug({ leagueId: "league-1", slug: "team-3" });

    expect(team).toMatchObject({ id: "team-3", isMine: true, isImported: true });
    expect(leagueTeamFindFirst).toHaveBeenCalledWith({
      where: { leagueId: "league-1", slug: "team-3" },
      include: { ...TEAM_INCLUDE, league: { select: { provider: true, myTeamId: true } } },
    });
  });

  it("marks a hand-built league's team neither mine nor imported", async () => {
    leagueTeamFindFirst.mockResolvedValue({
      ...teamRow({ id: "team-1", name: "First", createdAt: "2026-10-01" }),
      league: { provider: "manual", myTeamId: null },
    });

    const team = await getLeagueTeamBySlug({ leagueId: "league-1", slug: "team-1" });

    expect(team).toMatchObject({ id: "team-1", isMine: false, isImported: false });
  });

  it("returns null for a missing team", async () => {
    leagueTeamFindFirst.mockResolvedValue(null);

    expect(await getLeagueTeamBySlug({ leagueId: "league-1", slug: "nope" })).toBeNull();
  });
});
