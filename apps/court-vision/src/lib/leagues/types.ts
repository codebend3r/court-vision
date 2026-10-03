import { type LeagueScoringType } from "@vision/core/league/scoring";
import { type LeagueScoringConfig } from "@vision/sport-basketball/types";

import { type FantasyTeam } from "@/lib/fantasyTeams/types";

// Scoring payloads stored in League.scoringConfig (Json column), discriminated
// externally by League.scoringType and validated by lib/leagues/guards. The
// shapes are the shared engine's, bound to basketball.
export { type LeagueScoringType } from "@vision/core/league/scoring";
export {
  type H2hCategoriesConfig,
  type H2hPointsConfig,
  type LeagueScoringConfig,
  type RotoConfig,
} from "@vision/sport-basketball/types";

// Serializable league shape crossing the RSC boundary (dates as ISO strings).
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

// Mirrors LeagueMutationResult: server actions cross the RSC boundary, so
// errors are a result union, not throws.
export type LeagueTeamActionResult =
  | { status: "ok"; team: FantasyTeam }
  | { status: "ok-deleted" }
  | { status: "invalid" }
  | { status: "unauthenticated" }
  | { status: "error" };

// "skipped" means the default league already has teams — the legacy payload
// is stale and should be discarded without overwriting anything.
export type LegacyTeamsImportResult =
  | { status: "ok" }
  | { status: "skipped" }
  | { status: "unauthenticated" }
  | { status: "error" };
