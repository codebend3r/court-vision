import { type LeagueScoringType } from "@vision/core/league/scoring";
import { type LeagueScoringConfig } from "@vision/sport-basketball/types";

import { type FantasyTeam } from "@/lib/fantasyTeams/types";

// Where a league came from: built by hand in Court Vision, or imported from a
// fantasy host. An imported league's teams and scoring are the host's, so
// they're read-only here.
const LEAGUE_PROVIDERS = ["manual", "yahoo"] as const;

export type LeagueProvider = (typeof LEAGUE_PROVIDERS)[number];

export const isLeagueProvider = (value: string): value is LeagueProvider =>
  LEAGUE_PROVIDERS.some((provider) => provider === value);

// For display only: a stored provider this build doesn't know reads as a
// hand-built league. Never lock or scope on this; those decisions test the
// raw column (`provider !== "manual"`) so an unknown provider fails closed.
type ToLeagueProviderProps = { value: string };

export const toLeagueProvider = ({ value }: ToLeagueProviderProps): LeagueProvider =>
  isLeagueProvider(value) ? value : "manual";

// Which path keeps an imported league in sync: the server reads Yahoo
// directly, or the browser extension does, which is the only way to read a
// private league.
const LEAGUE_SYNC_VIAS = ["server", "extension"] as const;

export type LeagueSyncVia = (typeof LEAGUE_SYNC_VIAS)[number];

export const isLeagueSyncVia = (value: string): value is LeagueSyncVia =>
  LEAGUE_SYNC_VIAS.some((syncVia) => syncVia === value);

// For display only: a stored sync path this build doesn't know reads as the
// server. Never lock or scope on this; those decisions test the raw column,
// as they do for `provider`.
type ToLeagueSyncViaProps = { value: string };

export const toLeagueSyncVia = ({ value }: ToLeagueSyncViaProps): LeagueSyncVia =>
  isLeagueSyncVia(value) ? value : "server";

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
  provider: LeagueProvider;
  syncVia: LeagueSyncVia;
  // Fail-closed: true for any stored provider other than "manual", including
  // one this build doesn't know. Teams and scoring are read-only when true.
  isImported: boolean;
  // The league's page on its host; null for a hand-built league.
  externalUrl: string | null;
  // The LeagueTeam the user manages in an imported league. In an imported
  // league only this team is "yours"; a hand-built league has none.
  myTeamId: string | null;
  syncedAt: string | null; // ISO date of the last successful sync
  syncError: string | null;
  // Host categories the engine can't score, kept so the UI can say so.
  unsupportedCategories: string[];
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
