import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { recordFromKeys } from "#core/util/record";
import { ratioDefs } from "#core/valuation/categories";
import { type ValuationLine } from "#core/valuation/types";

// A valuation line for any sport from its season totals (absent stats are 0).
// Unless a test supplies `sq`/`cross`, the moments describe a player who posts
// an identical line every game, so within-player variance is exactly 0 and
// G-Score degenerates to Z-Score — the neutral baseline most tests want.
export const makeLine = <K extends SportKeys>({
  sport,
  playerId,
  position,
  gamesPlayed,
  playingTime,
  stats,
  sq,
  cross,
}: {
  sport: SportDescriptor<K>;
  playerId: number;
  position: string | null;
  gamesPlayed: number;
  playingTime: number;
  stats: Partial<Record<K["valued"], number>>;
  sq?: Record<K["valued"], number>;
  cross?: Record<K["ratio"], number>;
}): ValuationLine<K> => {
  const totals = recordFromKeys({ keys: sport.valuedStats, value: (key) => stats[key] ?? 0 });
  const constant = (product: number): number => (gamesPlayed > 0 ? product / gamesPlayed : 0);
  return {
    playerId,
    position,
    gamesPlayed,
    playingTime,
    stats: totals,
    sq:
      sq ??
      recordFromKeys({
        keys: sport.valuedStats,
        value: (key) => constant(totals[key] * totals[key]),
      }),
    cross:
      cross ??
      recordFromKeys({
        keys: ratioDefs({ sport }).map((def) => def.key),
        value: (key) =>
          constant(totals[sport.ratio[key].numerator] * totals[sport.ratio[key].denominator]),
      }),
  };
};
