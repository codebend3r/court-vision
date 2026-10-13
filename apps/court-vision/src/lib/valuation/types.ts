import { type BasketballLine } from "@vision/sport-basketball/types";

// One player's stat totals over the active window (full season or lastN): the
// engine's line plus the identity fields the tables render. Produced by
// lib/valuation/loader. The engine's own types come straight from
// `@vision/core/valuation/types` and `@vision/sport-basketball/types`.
export type FantasyStatLine = BasketballLine & {
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string | null;
  nbaPersonId: number | null;
};
