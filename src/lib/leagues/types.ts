import { type Category, type ScoringSettings } from "@/lib/valuation/types";

export type LeagueScoringType = "h2h_categories" | "h2h_points" | "roto";

// Per-type scoring payloads stored in League.scoringConfig (Json column).
// Discriminated externally by League.scoringType, validated by lib/leagues/guards.
export type H2hCategoriesConfig = {
  categories: Category[];
  weights?: Partial<Record<Category, number>>;
};
export type H2hPointsConfig = { scoring: ScoringSettings };
export type RotoConfig = { categories: Category[] };
export type LeagueScoringConfig = H2hCategoriesConfig | H2hPointsConfig | RotoConfig;

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
