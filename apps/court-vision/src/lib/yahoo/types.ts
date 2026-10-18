import { type LeagueSummary } from "@/lib/leagues/types";
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

// What the server actions answer. Each status has its user-facing copy in the
// import page; `unauthenticated` and `error` are `withProfile`'s.
export type YahooFailure =
  | { status: "invalid_url" }
  | { status: "wrong_sport" }
  | { status: "past_season" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "invalid_payload" }
  | { status: "highscore" }
  | { status: "unsupported_scoring" }
  | { status: "unauthenticated" }
  | { status: "error" };

export type YahooPreviewTeam = {
  externalKey: string;
  name: string;
  logoUrl: string | null;
  managerName: string | null;
  rosterCount: number;
  isOwnedByCurrentLogin: boolean;
};

export type YahooPreview = {
  name: string;
  logoUrl: string | null;
  meta: string; // formatLeagueMeta, e.g. "12-team · 9-cat"
  unsupportedCategories: string[];
  teams: YahooPreviewTeam[];
};

export type YahooPreviewResult = { status: "ok"; preview: YahooPreview } | YahooFailure;

export type YahooImportResult =
  | { status: "ok"; league: LeagueSummary; unmatched: string[] }
  | { status: "duplicate"; slug: string }
  | { status: "limit" }
  | { status: "invalid_team" }
  | YahooFailure;

export type YahooSyncResult =
  | { status: "ok"; syncedAt: string; unmatched: string[] }
  | { status: "throttled" }
  | { status: "not_imported" }
  | YahooFailure;

export type SetMyTeamResult =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "unauthenticated" }
  | { status: "error" };
