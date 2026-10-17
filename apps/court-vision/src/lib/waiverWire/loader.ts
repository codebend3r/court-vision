import { isRosterSlotType } from "@/lib/leagues/teams";
import { prisma } from "@/lib/prisma";
import { type WaiverLeagueData, type WaiverRosterEntry } from "@/lib/waiverWire/types";

// What the waiver model needs from the imported league: my roster, everyone
// rostered anywhere in the league, and the waiver list, each with its injury
// status, plus the slots whose player never matched by name. Uncached for the same reason as `getRosteredPlayerIds`: per user,
// a few hundred rows, and it must reflect a sync at once.
export const getWaiverLeagueData = async ({
  leagueId,
  myTeamId,
}: {
  leagueId: string;
  myTeamId: string;
}): Promise<WaiverLeagueData> => {
  const [slots, waivers] = await Promise.all([
    prisma.leagueTeamSlot.findMany({
      where: { team: { leagueId } },
      select: {
        playerId: true,
        slotType: true,
        injuryStatus: true,
        teamId: true,
        externalPlayerName: true,
        player: { select: { fullName: true } },
      },
    }),
    prisma.leagueWaiverPlayer.findMany({
      where: { leagueId },
      select: { playerId: true, injuryStatus: true },
    }),
  ]);

  const filled = slots.flatMap((slot) =>
    slot.playerId === null ? [] : [{ ...slot, playerId: slot.playerId }],
  );
  const myRoster = filled.flatMap((slot): WaiverRosterEntry[] =>
    slot.teamId === myTeamId && slot.player !== null && isRosterSlotType(slot.slotType)
      ? [
          {
            playerId: slot.playerId,
            fullName: slot.player.fullName,
            slotType: slot.slotType,
            injuryStatus: slot.injuryStatus,
          },
        ]
      : [],
  );

  // An empty slot has neither a player nor a Yahoo name; only a named one is
  // an unmatched player.
  const unmatched = slots.flatMap((slot) =>
    slot.playerId === null && slot.externalPlayerName !== null
      ? [{ fullName: slot.externalPlayerName, isMine: slot.teamId === myTeamId }]
      : [],
  );

  return {
    myRoster,
    rosteredPlayerIds: [...new Set(filled.map((slot) => slot.playerId))],
    waivers,
    unmatched,
  };
};
