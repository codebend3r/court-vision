import { isH2hPointsConfig } from "@/lib/leagues/guards";
import { type LeagueSummary } from "@/lib/leagues/types";
import { CATEGORY_KEYS } from "@/lib/valuation/categories";
import { type FantasyMethodKey } from "@/lib/valuation/registry";
import {
  type FantasySearchParams,
  type FantasySortKey,
  WEIGHTED_METHOD_KEYS,
} from "@/lib/valuation/searchParams";

export const SORT_KEY_BY_METHOD: Record<FantasyMethodKey, FantasySortKey> = {
  zscore: "z",
  gscore: "g",
  points: "points",
  vorp: "vorp",
  positional: "pos",
  sgp: "sgp",
  simvalue: "sim",
};

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
        : league?.scoringType === "h2h_points"
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
