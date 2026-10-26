import { basketball } from "@vision/sport-basketball/descriptor";

// The season the app is on, by the year it starts: 2026-27 → 2026. The
// Balldontlie adapter stringifies it at its param boundary; everything else
// keeps the number.
export const SEASON_START_YEAR = 2026;

// The only season type the app stores. The adapter drops playoff rows before
// they reach the database, so every stored row is regular season.
export const SEASON_TYPE = "Regular Season";

// "2026-27" for 2026, padded so 1999 → "1999-00", per basketball's descriptor.
type SeasonLabelProps = { startYear: number };

export const seasonLabel = ({ startYear }: SeasonLabelProps): string =>
  basketball.season.label({ startYear });

export const SEASON_LABEL = seasonLabel({ startYear: SEASON_START_YEAR });

// Historical backfill window: 2016-17 through the current season. 2016 is a
// choice, not an API limit — Balldontlie serves box scores back to 1946-47 and
// advanced stats back to 1996-97. Going below 1979-80 would need nullable
// era-gated columns, because a stored 0 for `stl` there would mean "the league
// did not record steals" and the valuation engine would score it as a real zero.
const BACKFILL_START_YEAR = 2016;

// Oldest first, so a backfill leaves player rows reflecting the most recent
// team and position.
export const BACKFILL_SEASON_YEARS: readonly number[] = Array.from(
  { length: SEASON_START_YEAR - BACKFILL_START_YEAR + 1 },
  (_, index) => BACKFILL_START_YEAR + index,
);

// Every season label the database can hold, newest first; these are the only
// seasons a ?season= value could name.
export const SEASON_OPTIONS: readonly string[] = BACKFILL_SEASON_YEARS.map((startYear) =>
  seasonLabel({ startYear }),
).toReversed();
