export type RosterSlotType =
  | "PG"
  | "SG"
  | "SF"
  | "PF"
  | "C"
  | "G"
  | "F"
  | "UTIL"
  | "BENCH"
  | "IL"
  | "ILPLUS";

export type FantasyTeamPlayer = {
  playerId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
};

export type RosterSlot = {
  id: string; // unique within a team, e.g. "UTIL-2"
  type: RosterSlotType;
  player: FantasyTeamPlayer | null;
};

export type SlotCounts = Record<RosterSlotType, number>;

export type FantasyTeam = {
  id: string;
  name: string;
  slots: RosterSlot[];
  createdAt: string; // ISO date
};
