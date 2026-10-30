import { slotMeta } from "@vision/sport-basketball/engine";

import { type FantasyTeam, type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

export type RosterEntry = {
  slotId: string;
  slotLabel: string;
  player: FantasyTeamPlayer;
  value: number | null;
};

// A team's filled slots, bench and IL included, highest season value first;
// a player with no value yet (no games) goes last, by name.
type RankRosterProps = { team: FantasyTeam; values: ReadonlyMap<number, number> };

export const rankRoster = ({ team, values }: RankRosterProps): RosterEntry[] =>
  team.slots
    .flatMap((slot): RosterEntry[] =>
      slot.player === null
        ? []
        : [
            {
              slotId: slot.id,
              slotLabel: slotMeta({ type: slot.type }).label,
              player: slot.player,
              value: values.get(slot.player.playerId) ?? null,
            },
          ],
    )
    .toSorted(
      (a, b) =>
        (b.value ?? Number.NEGATIVE_INFINITY) - (a.value ?? Number.NEGATIVE_INFINITY) ||
        a.player.fullName.localeCompare(b.player.fullName),
    );
