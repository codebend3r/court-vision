import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { type Basis, type ScoringSettings, type ValuationLine } from "#core/valuation/types";

// Points-League Linear (PRD §6.4): the dot product of the stat line with the
// league's scoring settings. No pool, no standardization. The sport's default
// table applies until the league's own Scoring controls override it, because a
// points league's whole identity is its scoring table.
export const scorePoints = <K extends SportKeys>({
  sport,
  lines,
  basis,
  scoring = sport.points.defaults,
}: {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
  basis: Basis;
  scoring?: Readonly<ScoringSettings<K>>;
}): Array<{ playerId: number; total: number }> =>
  lines.map((line) => {
    const raw = sport.points.keys.reduce((sum, key) => sum + line.stats[key] * scoring[key], 0);
    const total = basis === "total" ? raw : line.gamesPlayed > 0 ? raw / line.gamesPlayed : 0;
    return { playerId: line.playerId, total };
  });
