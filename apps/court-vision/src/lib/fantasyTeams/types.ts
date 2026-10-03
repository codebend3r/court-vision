import { type RosterSlot as CoreRosterSlot } from "@vision/core/roster/slots";
import { type BasketballKeys } from "@vision/sport-basketball/descriptor";

export { type RosterSlotType, type SlotCounts } from "@vision/sport-basketball/types";

export type FantasyTeamPlayer = {
  playerId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
};

export type RosterSlot = CoreRosterSlot<BasketballKeys, FantasyTeamPlayer>;

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
