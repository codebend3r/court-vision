import { type Category, type RosterSlotType } from "@vision/sport-basketball/types";

import { type WaiverLeagueData } from "@/lib/waiverWire/types";

// One team of the imported league with the matched players on its roster.
export type AdvisorTeam = {
  teamId: string;
  name: string;
  managerName: string | null;
  isMine: boolean;
  players: { playerId: number; slotType: RosterSlotType; injuryStatus: string | null }[];
};

// What the Roster Advisor reads from the imported league: everything the
// Waiver Wire reads (my roster, the waiver list, who is rostered), plus every
// team's roster so it can rank the league and find trade partners.
export type AdvisorLeagueData = WaiverLeagueData & { teams: AdvisorTeam[] };

// Where a player is: on my team, on another team, or free.
export type AdvisorOwner =
  | { kind: "mine" }
  | { kind: "team"; teamId: string; teamName: string; managerName: string | null }
  | { kind: "free_agent" }
  | { kind: "waivers" };

// A valued player as the advisor sees one: overall value on the league's
// method, and the score in the category being fixed.
export type AdvisorPlayer = {
  playerId: number;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  injuryStatus: string | null;
  value: number;
  categoryScore: number;
  owner: AdvisorOwner;
};

// Where my roster stands in one category against the league.
export type CategoryNeed = {
  key: Category;
  label: string;
  myTotal: number;
  leagueAverage: number;
  rank: number; // 1 is best
  of: number;
};

export type TradeTier = "favors_me" | "fair" | "favors_them";

export type TradeOffer = {
  tier: TradeTier;
  give: AdvisorPlayer[];
  get: AdvisorPlayer;
  // What I give minus what I get, in value: under 0 favours me.
  balance: number;
  // False when the offer sits outside its tier's band of value balance: the
  // roster had nothing nearer, so the card says so.
  reachesTier: boolean;
  // What the trade does to my roster's score in the weak category.
  categoryChange: number;
};

// One tier's options, best first.
export type TradeGroup = { tier: TradeTier; offers: TradeOffer[] };

export type FreeAgentPick = AdvisorPlayer & {
  // Value over the drop candidate; null with no one to drop.
  gainOverDrop: number | null;
  // False for a filler that helps the category but is worth less overall.
  isUpgrade: boolean;
};

export type Advice = {
  needs: CategoryNeed[]; // weakest first
  weakness: CategoryNeed;
  target: AdvisorPlayer | null;
  trades: TradeGroup[]; // every tier, in display order; empty with no trade target
  freeAgents: FreeAgentPick[];
  drop: AdvisorPlayer | null;
};
