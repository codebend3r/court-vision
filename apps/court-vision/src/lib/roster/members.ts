import { slotMeta } from "@vision/sport-basketball/engine";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";

export type RosterMember = {
  playerId: number;
  // The slot the player holds, as the roster shows it: "PG", "UTIL", "IL".
  slotLabel: string;
};

/** The team's players in slot order, each with the slot they hold. */
type RosterMembersProps = { team: FantasyTeam };

export const rosterMembers = ({ team }: RosterMembersProps): RosterMember[] =>
  team.slots.flatMap((slot) =>
    slot.player === null
      ? []
      : [{ playerId: slot.player.playerId, slotLabel: slotMeta({ type: slot.type }).label }],
  );

/** Yahoo names for slots whose player Court Vision couldn't match. */
type UnmatchedNamesProps = { team: FantasyTeam };

export const unmatchedNames = ({ team }: UnmatchedNamesProps): string[] =>
  Object.values(team.unmatchedBySlotId);

export type RosterRow<Row extends { id: number }> = { slotLabel: string; row: Row };

/**
 * Pairs each rostered player with their row in a stat pool. Players the pool
 * has no row for (no games yet this season) come back separately by id.
 */
type MatchRosterRowsProps<Row extends { id: number }> = {
  members: readonly RosterMember[];
  pool: readonly Row[];
};

export const matchRosterRows = <Row extends { id: number }>({
  members,
  pool,
}: MatchRosterRowsProps<Row>): { matched: RosterRow<Row>[]; missing: number[] } => {
  const byId = new Map(pool.map((row) => [row.id, row]));
  return members.reduce<{ matched: RosterRow<Row>[]; missing: number[] }>(
    (acc, { playerId, slotLabel }) => {
      const row = byId.get(playerId);
      return row === undefined
        ? { ...acc, missing: [...acc.missing, playerId] }
        : { ...acc, matched: [...acc.matched, { slotLabel, row }] };
    },
    { matched: [], missing: [] },
  );
};
