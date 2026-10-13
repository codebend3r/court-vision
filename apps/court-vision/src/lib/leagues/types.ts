import { type LeagueScoringType } from "@vision/core/league/scoring";
import { type LeagueScoringConfig } from "@vision/sport-basketball/types";

import { type FantasyTeam } from "@/lib/fantasyTeams/types";

// Serializable league shape crossing the RSC boundary (dates as ISO strings).
// `scoringConfig` is discriminated by `scoringType` and validated by the
// sport engine's scoring-config guards.
export type LeagueSummary = {
  id: string;
  name: string;
  slug: string;
  scoringType: LeagueScoringType;
  teamCount: number;
  rosterSlots: number;
  scoringConfig: LeagueScoringConfig;
  createdAt: string;
  updatedAt: string;
};

// Mirrors WatchlistActionResult (lib/watchlist/types.ts): server actions cross
// the RSC boundary, so errors are a result union, not throws.
export type LeagueMutationResult =
  | { status: "ok"; league: LeagueSummary }
  | { status: "limit" }
  | { status: "invalid" }
  | { status: "unauthenticated" }
  | { status: "error" };

export type LeagueDeleteResult =
  | { status: "ok"; activeLeagueId: string | null }
  | { status: "unauthenticated" }
  | { status: "error" };

export type SetActiveLeagueResult =
  | { status: "ok" }
  | { status: "unauthenticated" }
  | { status: "error" };

// Mirror LeagueMutationResult / LeagueDeleteResult: server actions cross the
// RSC boundary, so errors are a result union, not throws.
export type LeagueTeamSaveResult =
  | { status: "ok"; team: FantasyTeam }
  | { status: "invalid" }
  | { status: "unauthenticated" }
  | { status: "error" };

export type LeagueTeamDeleteResult =
  | { status: "ok" }
  | { status: "unauthenticated" }
  | { status: "error" };

// "skipped" means the default league already has teams — the legacy payload
// is stale and should be discarded without overwriting anything.
export type LegacyTeamsImportResult =
  | { status: "ok" }
  | { status: "skipped" }
  | { status: "unauthenticated" }
  | { status: "error" };
