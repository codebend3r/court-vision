import { type MappedScoring } from "@/lib/yahoo/settings";
import { type RosterSlotType } from "@vision/sport-basketball/types";

export type YahooPlayerRef = {
  yahooPlayerId: string; // "6404"
  fullName: string;
  teamAbbr: string | null; // Yahoo's abbreviations equal Balldontlie's (all 30 checked 2026-10-16)
  eligiblePositions: string[];
  status: string | null; // "Q", "O", "INJ", "P", … or null
};

export type ImportedSlot = { slotType: RosterSlotType; player: YahooPlayerRef | null };

export type ImportedTeam = {
  externalKey: string; // "478.l.106344.t.5"
  name: string;
  logoUrl: string | null;
  managerName: string | null; // null when Yahoo sends "--hidden--"
  isOwnedByCurrentLogin: boolean;
  slots: ImportedSlot[];
};

export type ImportedLeague = {
  externalKey: string; // "478.l.106344"
  externalUrl: string;
  name: string;
  logoUrl: string | null;
  season: number;
  teamCount: number;
  rosterSlots: number;
  scoring: MappedScoring;
  teams: ImportedTeam[];
};
