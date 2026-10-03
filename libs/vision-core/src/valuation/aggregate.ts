import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { recordFromKeys } from "#core/util/record";
import { ratioDefs } from "#core/valuation/categories";
import { type ValuationLine } from "#core/valuation/types";

// One game's line as the engine reads it: playing time plus the valued stats.
export type WindowLog<K extends SportKeys> = {
  playingTime: number;
  stats: Record<K["valued"], number>;
};

export type DatedLog<K extends SportKeys> = WindowLog<K> & { gameDate: Date };

export type WindowTotals<K extends SportKeys> = Omit<ValuationLine<K>, "playerId" | "position">;

// An appearance is a game with playing time; a DNP contributes nothing but
// also costs nothing.
export const isAppearance = ({ playingTime }: { playingTime: number }): boolean => playingTime > 0;

const emptyTotals = <K extends SportKeys>({
  sport,
}: {
  sport: SportDescriptor<K>;
}): WindowTotals<K> => ({
  gamesPlayed: 0,
  playingTime: 0,
  stats: recordFromKeys({ keys: sport.valuedStats, value: () => 0 }),
  sq: recordFromKeys({ keys: sport.valuedStats, value: () => 0 }),
  cross: recordFromKeys({ keys: ratioDefs({ sport }).map((def) => def.key), value: () => 0 }),
});

// Collapses a game-log window into one stat line. The second moments (sums of
// squares, numerator·denominator cross products) let the scorer reconstruct
// game-level variance for any league rate without re-reading the logs
// (G-Score's within-player term).
//
// Hot path: rolling trends re-aggregate a ten-game window for every plotted
// point. Each game copies the three running records once and adds into the
// copies, rather than spreading a fresh object per stat key.
export const aggregateWindowLogs = <K extends SportKeys>({
  sport,
  logs,
}: {
  sport: SportDescriptor<K>;
  logs: readonly WindowLog<K>[];
}): WindowTotals<K> => {
  const ratios = ratioDefs({ sport });
  return logs.reduce<WindowTotals<K>>((totals, game) => {
    const stats = { ...totals.stats };
    const sq = { ...totals.sq };
    const cross = { ...totals.cross };
    sport.valuedStats.forEach((key) => {
      const value = game.stats[key];
      stats[key] = totals.stats[key] + value;
      sq[key] = totals.sq[key] + value * value;
    });
    ratios.forEach((def) => {
      cross[def.key] =
        totals.cross[def.key] + game.stats[def.numerator] * game.stats[def.denominator];
    });
    return {
      gamesPlayed: totals.gamesPlayed + (isAppearance(game) ? 1 : 0),
      playingTime: totals.playingTime + game.playingTime,
      stats,
      sq,
      cross,
    };
  }, emptyTotals({ sport }));
};
