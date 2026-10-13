import { LEAGUE_BOUNDS } from "@/lib/leagues/settings";
import { type LeagueSummary } from "@/lib/leagues/types";
import {
  CATEGORY_KEYS,
  DEFAULT_POINTS_SCORING,
  isH2hPointsConfig,
} from "@vision/sport-basketball/engine";
import { SORT_KEY_BY_METHOD, WEIGHTED_METHOD_KEYS } from "@vision/core/valuation/registry";
import { type FantasyMethodKey } from "@vision/core/valuation/types";
import { type MethodWeights, type ValuationConfig } from "@vision/sport-basketball/types";
import { type FantasySearchParams } from "@/lib/valuation/searchParams";

export type FantasySeed = Partial<
  Pick<FantasySearchParams, "teams" | "slots" | "x" | "w" | "s" | "sort">
>;

// Defaults for fantasy URL params the current URL doesn't set. Explicit params
// always win — a key in presentKeys is never seeded — so shared links keep
// meaning exactly what they said.
export const buildLeagueSeed = ({
  league,
  preferredFormula,
  presentKeys,
}: {
  league: LeagueSummary | null;
  preferredFormula: FantasyMethodKey | null;
  presentKeys: ReadonlySet<string>;
}): FantasySeed => {
  const sortSeed: FantasySeed =
    presentKeys.has("sort") === false
      ? preferredFormula !== null
        ? { sort: SORT_KEY_BY_METHOD[preferredFormula] }
        : league !== null && league.scoringType === "h2h_points"
          ? { sort: "points" }
          : {}
      : {};
  if (league === null) return sortSeed;
  const sizeSeed: FantasySeed = {
    ...(presentKeys.has("teams") ? {} : { teams: league.teamCount }),
    ...(presentKeys.has("slots") ? {} : { slots: league.rosterSlots }),
  };
  const config = league.scoringConfig;
  if (isH2hPointsConfig(config)) {
    return {
      ...sortSeed,
      ...sizeSeed,
      ...(presentKeys.has("s") ? {} : { s: { ...config.scoring } }),
    };
  }
  const excluded = CATEGORY_KEYS.filter(
    (key) => !config.categories.some((included) => included === key),
  );
  const weights = "weights" in config ? (config.weights ?? {}) : {};
  const hasWeights = Object.keys(weights).length > 0;
  return {
    ...sortSeed,
    ...sizeSeed,
    ...(presentKeys.has("x") || excluded.length === 0 ? {} : { x: excluded }),
    ...(presentKeys.has("w") || !hasWeights
      ? {}
      : {
          w: WEIGHTED_METHOD_KEYS.reduce(
            (acc, method) => ({ ...acc, [method]: { ...weights } }),
            {},
          ),
        }),
  };
};

// The Fantasy tab's URL defaults, applied straight from the league seed: same
// numbers as the tab shows on first load, without the tab's controls.
export const configFromSeed = ({
  seed,
}: {
  seed: FantasySeed;
}): { config: ValuationConfig; methodWeights: MethodWeights } => {
  const excluded = seed.x ?? [];
  return {
    config: {
      categories: CATEGORY_KEYS.filter((key) => !excluded.some((entry) => entry === key)),
      weights: {},
      basis: "perGame",
      teams: seed.teams ?? LEAGUE_BOUNDS.teams.fallback,
      rosterSlots: seed.slots ?? LEAGUE_BOUNDS.slots.fallback,
      scoring: seed.s ?? { ...DEFAULT_POINTS_SCORING },
    },
    methodWeights: seed.w ?? {},
  };
};
