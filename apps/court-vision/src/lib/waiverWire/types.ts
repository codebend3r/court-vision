import { type RosterSlotType } from "@vision/sport-basketball/types";

// The position-group filter on the free pool. `all` keeps every group.
export type WaiverPosition = "all" | "G" | "F" | "C";

// One of my team's matched players, in the slot the league has them in.
export type WaiverRosterEntry = {
  playerId: number;
  fullName: string;
  slotType: RosterSlotType;
  injuryStatus: string | null;
};

// The league-side input to the waiver model, read from the imported league.
export type WaiverLeagueData = {
  myRoster: WaiverRosterEntry[]; // my team's matched players
  rosteredPlayerIds: number[]; // matched players on every team in the league
  waivers: { playerId: number; injuryStatus: string | null }[];
  // Slots whose Yahoo player never matched a Court Vision player, by the name
  // Yahoo gave. They count as rostered nowhere, so they can read as free agents.
  unmatched: { fullName: string; isMine: boolean }[];
};

export type WaiverOwner = "mine" | "free_agent" | "waivers";

export type WaiverRow = {
  playerId: number;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
  value: number;
  rank: number; // rank across the whole valued pool, 1-based
  owner: WaiverOwner;
  injuryStatus: string | null;
};

export type WaiverModel = {
  roster: WaiverRow[]; // mine, valued, not IL/IL+, value desc
  noStats: WaiverRosterEntry[]; // mine, not IL/IL+, no line in the range
  weakest: WaiverRow[]; // up to three, lowest first
  freePool: WaiverRow[]; // value desc, after the position filter
};
