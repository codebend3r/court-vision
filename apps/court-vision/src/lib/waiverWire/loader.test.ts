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

type SlotProps = {
  teamId: string;
  playerId: number;
  slotType: string;
  injuryStatus?: string | null;
  fullName?: string;
};

const slot = ({
  teamId,
  playerId,
  slotType,
  injuryStatus = null,
  fullName = "Player",
}: SlotProps) => ({
  teamId,
  playerId,
  slotType,
  injuryStatus,
  externalPlayerName: fullName,
  player: { fullName },
});

// A slot whose Yahoo player never matched: no player id, only Yahoo's name.
type UnmatchedSlotProps = {
  teamId: string;
  externalPlayerName: string | null;
};

const unmatchedSlot = ({ teamId, externalPlayerName }: UnmatchedSlotProps) => ({
  teamId,
  playerId: null,
  slotType: "BE",
  injuryStatus: null,
  externalPlayerName,
  player: null,
});

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
      unmatched: [],
    });
    expect(slotFindMany).toHaveBeenCalledTimes(1);
    // No playerId filter: the unmatched slots are read too.
    expect(slotFindMany).toHaveBeenCalledWith({
      where: { team: { leagueId: "league-1" } },
      select: {
        playerId: true,
        slotType: true,
        injuryStatus: true,
        teamId: true,
        externalPlayerName: true,
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

  it("skips empty slot rows", async () => {
    slotFindMany.mockResolvedValue([unmatchedSlot({ teamId: "mine", externalPlayerName: null })]);

    expect(await getWaiverLeagueData({ leagueId: "league-1", myTeamId: "mine" })).toEqual({
      myRoster: [],
      rosteredPlayerIds: [],
      waivers: [],
      unmatched: [],
    });
  });

  it("splits unmatched slots out by Yahoo name, marking mine", async () => {
    slotFindMany.mockResolvedValue([
      slot({ teamId: "mine", playerId: 1, slotType: "PG", fullName: "Ann Guard" }),
      unmatchedSlot({ teamId: "mine", externalPlayerName: "Bronny James" }),
      unmatchedSlot({ teamId: "other", externalPlayerName: "Kel'el Ware" }),
      slot({ teamId: "other", playerId: 3, slotType: "C" }),
    ]);

    const data = await getWaiverLeagueData({ leagueId: "league-1", myTeamId: "mine" });

    expect(data.unmatched).toEqual([
      { fullName: "Bronny James", isMine: true },
      { fullName: "Kel'el Ware", isMine: false },
    ]);
    expect(data.myRoster.map((entry) => entry.playerId)).toEqual([1]);
    expect(data.rosteredPlayerIds).toEqual([1, 3]);
  });
});
