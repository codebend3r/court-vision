import { type FantasyPlayerValues } from "@vision/core/valuation/types";
import { buildYardstick, poolStatsFor } from "@vision/sport-basketball/engine";
import { type PoolStats, type Yardstick } from "@vision/sport-basketball/types";

import { type LeagueValuationSettings } from "@/lib/valuation/leagueSettings";
import { getFantasyPool } from "@/lib/valuation/loader";
import { type FantasyStatLine } from "@/lib/valuation/types";

// The whole season's pool valued once on one league's settings: its lines,
// their pool stats, the yardstick every method measures against (SGP and Sim
// Value each simulate a league to build it, so it is the expensive part), and
// every player's season value read off that yardstick. A server page builds
// this once and hands it to every surface that values players, so a season
// value and a rolling reading share one scale and the yardstick is never
// rebuilt within a request.
export type SeasonValuation = {
  lines: FantasyStatLine[];
  poolStats: PoolStats;
  yardstick: Yardstick;
  values: FantasyPlayerValues[];
};

type GetSeasonValuationProps = {
  settings: Pick<LeagueValuationSettings, "config" | "methodWeights">;
};

export const getSeasonValuation = async ({
  settings: { config, methodWeights },
}: GetSeasonValuationProps): Promise<SeasonValuation> => {
  const lines = await getFantasyPool({ range: "all" });
  const poolStats = poolStatsFor({ lines, config, windowGames: null });
  const yardstick = buildYardstick({ lines, poolStats, config, methodWeights });
  return { lines, poolStats, yardstick, values: yardstick.value({ lines }) };
};
