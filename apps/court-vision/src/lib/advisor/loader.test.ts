import { beforeEach, describe, expect, it, vi } from "bun:test";

const teamFindMany = vi.fn();
const getWaiverLeagueData = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: { leagueTeam: { findMany: teamFindMany } } }));
type GetWaiverLeagueDataProps = { leagueId: string; myTeamId: string };

vi.mock("@/lib/waiverWire/loader", () => ({
  getWaiverLeagueData: (args: GetWaiverLeagueDataProps) => getWaiverLeagueData(args),
}));

const { getAdvisorLeagueData, toAdvisorTeams } = await import("@/lib/advisor/loader");

const WAIVER = { myRoster: [], rosteredPlayerIds: [1], waivers: [], unmatched: [] };
const TEAMS = [
  {
    id: "t1",
    name: "One",
    managerName: null,
    slots: [
      { playerId: 1, slotType: "PG", injuryStatus: null },
      { playerId: null, slotType: "BENCH", injuryStatus: null },
      { playerId: 2, slotType: "nonsense", injuryStatus: null },
    ],
  },
  {
    id: "t2",
    name: "Two",
    managerName: "Sam",
    slots: [{ playerId: 3, slotType: "IL", injuryStatus: "O" }],
  },
];

beforeEach(() => {
  teamFindMany.mockReset().mockResolvedValue(TEAMS);
  getWaiverLeagueData.mockReset().mockResolvedValue(WAIVER);
});

describe("toAdvisorTeams", () => {
  it("keeps matched players in known slots and flags my team", () => {
    expect(toAdvisorTeams({ teams: TEAMS, myTeamId: "t1" })).toEqual([
      {
        teamId: "t1",
        name: "One",
        managerName: null,
        isMine: true,
        players: [{ playerId: 1, slotType: "PG", injuryStatus: null }],
      },
      {
        teamId: "t2",
        name: "Two",
        managerName: "Sam",
        isMine: false,
        players: [{ playerId: 3, slotType: "IL", injuryStatus: "O" }],
      },
    ]);
  });
});

describe("getAdvisorLeagueData", () => {
  it("adds every team's roster to the Waiver Wire's data", async () => {
    const data = await getAdvisorLeagueData({ leagueId: "l1", myTeamId: "t1" });
    expect(getWaiverLeagueData).toHaveBeenCalledWith({ leagueId: "l1", myTeamId: "t1" });
    expect(teamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leagueId: "l1" } }),
    );
    expect(data.rosteredPlayerIds).toEqual([1]);
    expect(data.teams.map(({ teamId }) => teamId)).toEqual(["t1", "t2"]);
  });
});
