import { SLOT_TYPES } from "@/lib/fantasyTeams/slots";
import {
  type FantasyTeamPlayer,
  type RosterSlot,
  type RosterSlotType,
} from "@/lib/fantasyTeams/types";

export const isRosterSlotType = (value: string): value is RosterSlotType =>
  SLOT_TYPES.some((type) => type === value);

export const isFantasyTeamPlayer = (value: unknown): value is FantasyTeamPlayer => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return (
    typeof record.playerId === "number" &&
    typeof record.firstName === "string" &&
    typeof record.lastName === "string" &&
    typeof record.fullName === "string" &&
    (record.teamAbbr === null || typeof record.teamAbbr === "string") &&
    (record.position === null || typeof record.position === "string") &&
    (record.nbaPersonId === null || typeof record.nbaPersonId === "number")
  );
};

export type LeagueTeamSlotRow = {
  slotType: string;
  player: FantasyTeamPlayer | null;
};

export const slotsToRows = ({
  slots,
}: {
  slots: readonly RosterSlot[];
}): Array<{ slotType: RosterSlotType; position: number; playerId: number | null }> =>
  slots.map((slot, index) => ({
    slotType: slot.type,
    position: index,
    playerId: slot.player?.playerId ?? null,
  }));

// DB rows (ordered by position) → RosterSlot[]. Ids are regenerated as
// "<TYPE>-<n>" per type, matching lib/fantasyTeams/slots.ts buildSlots.
export const rowsToSlots = ({ rows }: { rows: readonly LeagueTeamSlotRow[] }): RosterSlot[] =>
  rows.reduce<{ counts: Partial<Record<RosterSlotType, number>>; slots: RosterSlot[] }>(
    (acc, row) => {
      if (!isRosterSlotType(row.slotType)) return acc;
      const ordinal = (acc.counts[row.slotType] ?? 0) + 1;
      return {
        counts: { ...acc.counts, [row.slotType]: ordinal },
        slots: [
          ...acc.slots,
          { id: `${row.slotType}-${ordinal}`, type: row.slotType, player: row.player },
        ],
      };
    },
    { counts: {}, slots: [] },
  ).slots;
