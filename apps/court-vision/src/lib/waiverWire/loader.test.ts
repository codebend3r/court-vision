import { beforeEach, describe, expect, it, vi } from "bun:test";

const slotFindMany = vi.fn();
const waiverFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leagueTeamSlot: { findMany: slotFindMany },
    leagueWaiverPlayer: { findMany: waiverFindMany },
  },
}));

import { getWaiverLeagueData } from "@/lib/waiverWire/loader";

const slot = ({
  teamId,
  playerId,
  slotType,
  injuryStatus = null,
  fullName = "Player",
}: {
  teamId: string;
  playerId: number;
  slotType: string;
  injuryStatus?: string | null;
  fullName?: string;
}) => ({ teamId, playerId, slotType, injuryStatus, player: { fullName } });

beforeEach(() => {
  slotFindMany.mockReset();
  waiverFindMany.mockReset();
  waiverFindMany.mockResolvedValue([]);
});

describe("getWaiverLeagueData", () => {
  it("reads my roster, every rostered id and the waivers", async () => {
    slotFindMany.mockResolvedValue([
      slot({ teamId: "mine", playerId: 1, slotType: "PG", fullName: "Ann Guard" }),
      slot({ teamId: "mine", playerId: 2, slotType: "IL", injuryStatus: "O", fullName: "Bo Hurt" }),
      slot({ teamId: "other", playerId: 3, slotType: "C" }),
      slot({ teamId: "other", playerId: 1, slotType: "BE" }),
    ]);
    waiverFindMany.mockResolvedValue([{ playerId: 9, injuryStatus: "Q" }]);

    const data = await getWaiverLeagueData({ leagueId: "league-1", myTeamId: "mine" });

    expect(data).toEqual({
      myRoster: [
        { playerId: 1, fullName: "Ann Guard", slotType: "PG", injuryStatus: null },
        { playerId: 2, fullName: "Bo Hurt", slotType: "IL", injuryStatus: "O" },
      ],
      rosteredPlayerIds: [1, 2, 3],
      waivers: [{ playerId: 9, injuryStatus: "Q" }],
    });
    expect(slotFindMany).toHaveBeenCalledTimes(1);
    expect(slotFindMany).toHaveBeenCalledWith({
      where: { team: { leagueId: "league-1" }, playerId: { not: null } },
      select: {
        playerId: true,
        slotType: true,
        injuryStatus: true,
        teamId: true,
        player: { select: { fullName: true } },
      },
    });
    expect(waiverFindMany).toHaveBeenCalledTimes(1);
    expect(waiverFindMany).toHaveBeenCalledWith({
      where: { leagueId: "league-1" },
      select: { playerId: true, injuryStatus: true },
    });
  });

  it("drops my slots whose type this build does not know", async () => {
    slotFindMany.mockResolvedValue([
      slot({ teamId: "mine", playerId: 1, slotType: "PG" }),
      slot({ teamId: "mine", playerId: 2, slotType: "NOPE" }),
    ]);

    const data = await getWaiverLeagueData({ leagueId: "league-1", myTeamId: "mine" });

    expect(data.myRoster.map((entry) => entry.playerId)).toEqual([1]);
    expect(data.rosteredPlayerIds).toEqual([1, 2]);
  });

  it("skips slot rows with no player", async () => {
    slotFindMany.mockResolvedValue([
      { teamId: "mine", playerId: null, slotType: "PG", injuryStatus: null, player: null },
    ]);

    expect(await getWaiverLeagueData({ leagueId: "league-1", myTeamId: "mine" })).toEqual({
      myRoster: [],
      rosteredPlayerIds: [],
      waivers: [],
    });
  });
});
