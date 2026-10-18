import { type LeagueScoringType } from "@vision/core/league/scoring";
import {
  type Category,
  type LeagueScoringConfig,
  type RosterSlotType,
  type ScoringSettings,
  type ScoringStatKey,
} from "@vision/sport-basketball/types";

import { clampInt, LEAGUE_BOUNDS } from "@/lib/leagues/settings";
import { NON_ROSTER_SLOTS } from "@/lib/leagues/slots";
import { type YahooLeague } from "@/lib/yahoo/schemas";

// Yahoo identifies stats by numeric id. Ratio categories (FG%, FT%) and the
// counting ones share the category map; points leagues use their own keys,
// where made threes are `fg3m`.
export const YAHOO_CATEGORY_BY_STAT_ID: Readonly<Record<number, Category>> = {
  5: "fg",
  8: "ft",
  10: "tpm",
  12: "pts",
  15: "reb",
  16: "ast",
  17: "stl",
  18: "blk",
  19: "tov",
};

export const YAHOO_POINTS_KEY_BY_STAT_ID: Readonly<Record<number, ScoringStatKey>> = {
  12: "pts",
  15: "reb",
  16: "ast",
  17: "stl",
  18: "blk",
  10: "fg3m",
  19: "tov",
};

export const YAHOO_SLOT_BY_POSITION: Readonly<Record<string, RosterSlotType>> = {
  PG: "PG",
  SG: "SG",
  G: "G",
  SF: "SF",
  PF: "PF",
  F: "F",
  C: "C",
  Util: "UTIL",
  BN: "BENCH",
  IL: "IL",
  "IL+": "ILPLUS",
};

const YAHOO_SCORING_TYPES: Readonly<Record<string, LeagueScoringType>> = {
  head: "h2h_categories",
  roto: "roto",
  headpoint: "h2h_points",
  point: "h2h_points",
};

const ZERO_POINTS_SCORING: ScoringSettings = {
  pts: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  fg3m: 0,
  tov: 0,
};

/** Unknown or missing Yahoo positions (`NA`, `null`) sit on the bench. */
export const toSlotType = ({ position }: { position: string | null }): RosterSlotType =>
  (position !== null && Object.hasOwn(YAHOO_SLOT_BY_POSITION, position)
    ? YAHOO_SLOT_BY_POSITION[position]
    : undefined) ?? "BENCH";

export type MappedScoring = {
  scoringType: LeagueScoringType;
  scoringConfig: LeagueScoringConfig;
  unsupportedCategories: string[]; // Yahoo display names, in Yahoo's order
};

export type MappedSettings =
  | {
      status: "ok";
      scoring: MappedScoring;
      slotLayout: RosterSlotType[];
      rosterSlots: number;
      teamCount: number;
    }
  | { status: "unsupported"; reason: "highscore" | "scoring_type" };

const lookup = <Value>({
  table,
  statId,
}: {
  table: Readonly<Record<number, Value>>;
  statId: number;
}): Value | undefined => (Object.hasOwn(table, statId) ? table[statId] : undefined);

const mapScoring = ({
  league,
  scoringType,
}: {
  league: YahooLeague;
  scoringType: LeagueScoringType;
}): MappedScoring => {
  const stats = league.settings.stat_categories.stats;

  if (scoringType === "h2h_points") {
    const modifiers = league.settings.stat_modifiers ?? [];
    const scoring = modifiers.reduce<ScoringSettings>((acc, { stat_id, value }) => {
      const key = lookup({ table: YAHOO_POINTS_KEY_BY_STAT_ID, statId: stat_id });
      return key === undefined ? acc : { ...acc, [key]: value };
    }, ZERO_POINTS_SCORING);
    const unsupportedCategories = modifiers
      .filter(
        ({ stat_id }) =>
          lookup({ table: YAHOO_POINTS_KEY_BY_STAT_ID, statId: stat_id }) === undefined,
      )
      .map(
        ({ stat_id }) =>
          stats.find((stat) => stat.stat_id === stat_id)?.display_name ?? String(stat_id),
      );
    return { scoringType, scoringConfig: { scoring }, unsupportedCategories };
  }

  const scored = stats.filter((stat) => !stat.is_only_display_stat);
  const categories = scored.flatMap(({ stat_id }) => {
    const category = lookup({ table: YAHOO_CATEGORY_BY_STAT_ID, statId: stat_id });
    return category === undefined ? [] : [category];
  });
  const unsupportedCategories = scored
    .filter(
      ({ stat_id }) => lookup({ table: YAHOO_CATEGORY_BY_STAT_ID, statId: stat_id }) === undefined,
    )
    .map(({ display_name }) => display_name);
  return { scoringType, scoringConfig: { categories }, unsupportedCategories };
};

/** Maps a parsed Yahoo league onto the basketball descriptor's scoring and roster shape. */
export const mapLeagueSettings = ({ league }: { league: YahooLeague }): MappedSettings => {
  if (league.is_highscore || league.settings.is_highscore) {
    return { status: "unsupported", reason: "highscore" };
  }

  const scoringType = Object.hasOwn(YAHOO_SCORING_TYPES, league.scoring_type)
    ? YAHOO_SCORING_TYPES[league.scoring_type]
    : undefined;
  if (scoringType === undefined) return { status: "unsupported", reason: "scoring_type" };

  const slotLayout = league.settings.roster_positions.flatMap(({ position, count }) =>
    Array.from({ length: count }, () => toSlotType({ position })),
  );
  const scoring = mapScoring({ league, scoringType });
  // An empty list would make `parseScoringConfig` swap in the default categories,
  // silently changing the league's scoring, so refuse it instead. A points league
  // that scores nothing we value (every modifier unsupported) is refused alike.
  if ("categories" in scoring.scoringConfig && scoring.scoringConfig.categories.length === 0) {
    return { status: "unsupported", reason: "scoring_type" };
  }
  if (
    "scoring" in scoring.scoringConfig &&
    Object.values(scoring.scoringConfig.scoring).every((points) => points === 0)
  ) {
    return { status: "unsupported", reason: "scoring_type" };
  }

  const rosterSlots = slotLayout.filter((slot) => !NON_ROSTER_SLOTS.includes(slot)).length;

  return {
    status: "ok",
    scoring,
    slotLayout,
    rosterSlots: clampInt({ value: rosterSlots, ...LEAGUE_BOUNDS.slots }),
    teamCount: clampInt({ value: league.num_teams, ...LEAGUE_BOUNDS.teams }),
  };
};
