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
  // DB slug, assigned once at create and stable across renames — links must
  // use this, never recompute from `name` (a rename or duplicate name would
  // then 404 or collide). Legacy/localStorage-sourced teams that predate the
  // DB may carry "" here; server actions resolve a real slug on import.
  slug: string;
  slots: RosterSlot[];
  createdAt: string; // ISO date
};
