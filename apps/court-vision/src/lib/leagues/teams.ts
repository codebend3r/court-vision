import { isRecord } from "@vision/core/util/record";
import { SLOT_TYPES } from "@vision/sport-basketball/engine";
import {
  type FantasyTeam,
  type FantasyTeamPlayer,
  type RosterSlot,
  type RosterSlotType,
} from "@/lib/fantasyTeams/types";

export const isRosterSlotType = (value: string): value is RosterSlotType =>
  SLOT_TYPES.some((type) => type === value);

export const isFantasyTeamPlayer = (value: unknown): value is FantasyTeamPlayer =>
  isRecord(value) &&
  typeof value.playerId === "number" &&
  typeof value.firstName === "string" &&
  typeof value.lastName === "string" &&
  typeof value.fullName === "string" &&
  (value.teamAbbr === null || typeof value.teamAbbr === "string") &&
  (value.position === null || typeof value.position === "string") &&
  (value.nbaPersonId === null || typeof value.nbaPersonId === "number");

// One roster slot as it arrives untrusted: from a server action's arguments or
// a legacy localStorage payload.
export const isRosterSlot = (value: unknown): value is RosterSlot =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.type === "string" &&
  isRosterSlotType(value.type) &&
  (value.player === null || isFantasyTeamPlayer(value.player));

export type LeagueTeamSlotRow = {
  slotType: string;
  // The host's name for an imported slot's player; null for a hand-built slot.
  externalPlayerName: string | null;
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

const parseLegacySlot = (value: unknown): RosterSlot | null =>
  isRosterSlot(value)
    ? {
        id: value.id,
        type: value.type,
        player: value.player === null ? null : rebuildPlayer(value.player),
      }
    : null;

const parseLegacyTeam = (value: unknown): FantasyTeam | null => {
  if (!isRecord(value)) return null;
  const { id, name, createdAt, slots } = value;
  if (typeof id !== "string" || typeof name !== "string" || typeof createdAt !== "string") {
    return null;
  }
  if (!Array.isArray(slots)) return null;
  const parsedSlots = slots.map(parseLegacySlot);
  const validSlots = parsedSlots.filter((slot): slot is RosterSlot => slot !== null);
  if (validSlots.length !== parsedSlots.length) return null;
  // No DB row exists yet for a legacy team, so there's no real slug to carry
  // over; importLegacyTeams computes a fresh collision-proof one server-side.
  // A legacy team predates imported leagues, so it carries none of their
  // fields.
  return {
    id,
    name,
    slug: "",
    createdAt,
    slots: validSlots,
    logoUrl: null,
    managerName: null,
    isMine: false,
    isImported: false,
    unmatchedBySlotId: {},
  };
};

// Narrows the persisted zustand payload `{ state: { teams: [...] }, version }`
// into a fresh FantasyTeam[], never the input object. Any malformed team
// invalidates the whole payload rather than silently dropping it.
export const parseLegacyTeamsPayload = (value: unknown): FantasyTeam[] | null => {
  if (!isRecord(value) || !isRecord(value.state)) return null;
  const { teams } = value.state;
  if (!Array.isArray(teams)) return null;
  const parsedTeams = teams.map(parseLegacyTeam);
  const validTeams = parsedTeams.filter((team): team is FantasyTeam => team !== null);
  return validTeams.length === parsedTeams.length ? validTeams : null;
};

type SlotsToRowsProps = {
  slots: readonly RosterSlot[];
};

export const slotsToRows = ({
  slots,
}: SlotsToRowsProps): Array<{
  slotType: RosterSlotType;
  position: number;
  playerId: number | null;
}> =>
  slots.map((slot, index) => ({
    slotType: slot.type,
    position: index,
    playerId: slot.player?.playerId ?? null,
  }));

type TeamSlots = { slots: RosterSlot[]; unmatchedBySlotId: Record<string, string> };

// DB rows (ordered by position) → RosterSlot[]. Ids are regenerated as
// "<TYPE>-<n>" per type, matching lib/fantasyTeams/slots.ts buildSlots. An
// imported slot whose host player matched no Court Vision player keeps the
// host's name under its slot id, so the roster can still show who's there.
type RowsToTeamSlotsProps = { rows: readonly LeagueTeamSlotRow[] };

export const rowsToTeamSlots = ({ rows }: RowsToTeamSlotsProps): TeamSlots => {
  const { slots, unmatchedBySlotId } = rows.reduce<
    TeamSlots & { counts: Partial<Record<RosterSlotType, number>> }
  >(
    (acc, row) => {
      if (!isRosterSlotType(row.slotType)) return acc;
      const ordinal = (acc.counts[row.slotType] ?? 0) + 1;
      const id = `${row.slotType}-${ordinal}`;
      const unmatchedName = row.player === null ? row.externalPlayerName : null;
      return {
        counts: { ...acc.counts, [row.slotType]: ordinal },
        slots: [...acc.slots, { id, type: row.slotType, player: row.player }],
        unmatchedBySlotId:
          unmatchedName === null
            ? acc.unmatchedBySlotId
            : { ...acc.unmatchedBySlotId, [id]: unmatchedName },
      };
    },
    { counts: {}, slots: [], unmatchedBySlotId: {} },
  );
  return { slots, unmatchedBySlotId };
};

type RowsToSlotsProps = { rows: readonly LeagueTeamSlotRow[] };

export const rowsToSlots = ({ rows }: RowsToSlotsProps): RosterSlot[] =>
  rowsToTeamSlots({ rows }).slots;
