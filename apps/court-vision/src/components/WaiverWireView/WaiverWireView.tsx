import { type FantasyMethodKey } from "@vision/core/valuation/types";
import { type MethodWeights, type ValuationConfig } from "@vision/sport-basketball/types";

import { type LeagueSummary } from "@/lib/leagues/types";
import { GAME_RANGE_LABELS, type PlayerGameRange } from "@/lib/players/searchParams";
import { type FantasyStatLine } from "@/lib/valuation/types";
import { type WaiverLeagueData } from "@/lib/waiverWire/types";

export type WaiverWireViewProps = {
  league: LeagueSummary;
  range: PlayerGameRange;
  method: FantasyMethodKey;
  lines: FantasyStatLine[];
  activePlayerIds: number[];
  leagueData: WaiverLeagueData;
  config: ValuationConfig;
  methodWeights: MethodWeights;
};

// Placeholder until the view lands: the page already hands it everything the
// valuation and the three tabs need.
export function WaiverWireView({ range }: WaiverWireViewProps) {
  return (
    <section data-testid="waiver-wire-view" aria-label="Waiver Wire">
      <p>{GAME_RANGE_LABELS[range]}</p>
    </section>
  );
}
