import { SLOT_TYPES } from "@/lib/fantasyTeams/slots";
import {
  type FantasyTeam,
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

// Rebuilds a fresh player object from narrowed fields rather than trusting
// the guard-checked input reference.
const rebuildPlayer = (player: FantasyTeamPlayer): FantasyTeamPlayer => ({
  playerId: player.playerId,
  firstName: player.firstName,
  lastName: player.lastName,
  fullName: player.fullName,
  teamAbbr: player.teamAbbr,
  position: player.position,
  nbaPersonId: player.nbaPersonId,
});

const parseLegacySlot = (value: unknown): RosterSlot | null => {
  if (typeof value !== "object" || value === null) return null;
  const record: Record<string, unknown> = { ...value };
  const { id, type, player } = record;
  if (typeof id !== "string") return null;
  if (typeof type !== "string" || !isRosterSlotType(type)) return null;
  if (player !== null && !isFantasyTeamPlayer(player)) return null;
  return { id, type, player: player === null ? null : rebuildPlayer(player) };
};

const parseLegacyTeam = (value: unknown): FantasyTeam | null => {
  if (typeof value !== "object" || value === null) return null;
  const record: Record<string, unknown> = { ...value };
  const { id, name, createdAt, slots } = record;
  if (typeof id !== "string" || typeof name !== "string" || typeof createdAt !== "string") {
    return null;
  }
  if (!Array.isArray(slots)) return null;
  const parsedSlots = slots.map(parseLegacySlot);
  const validSlots = parsedSlots.filter((slot): slot is RosterSlot => slot !== null);
  if (validSlots.length !== parsedSlots.length) return null;
  return { id, name, createdAt, slots: validSlots };
};

// Narrows the persisted zustand payload `{ state: { teams: [...] }, version }`
// into a fresh FantasyTeam[], never the input object. Any malformed team
// invalidates the whole payload rather than silently dropping it.
export const parseLegacyTeamsPayload = (value: unknown): FantasyTeam[] | null => {
  if (typeof value !== "object" || value === null) return null;
  const record: Record<string, unknown> = { ...value };
  const { state } = record;
  if (typeof state !== "object" || state === null) return null;
  const stateRecord: Record<string, unknown> = { ...state };
  const { teams } = stateRecord;
  if (!Array.isArray(teams)) return null;
  const parsedTeams = teams.map(parseLegacyTeam);
  const validTeams = parsedTeams.filter((team): team is FantasyTeam => team !== null);
  return validTeams.length === parsedTeams.length ? validTeams : null;
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
