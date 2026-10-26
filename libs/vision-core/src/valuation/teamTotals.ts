import {
  type Category,
  type Direction,
  type SportDescriptor,
  type SportKeys,
} from "#core/sport/types";
import { categoryDef } from "#core/valuation/categories";
import { type ValuationLine } from "#core/valuation/types";

export type TeamCategoryTotal<K extends SportKeys> = {
  key: Category<K>;
  direction: Direction;
  // Counting: the sum of each player's per-game line. Ratio: the team's rate,
  // scale · Σ numerator per game ÷ Σ denominator per game, never an average of
  // player rates. Zero volume reads 0, never NaN.
  value: number;
};

type PerGameProps = { total: number; gamesPlayed: number };

const perGame = ({ total, gamesPlayed }: PerGameProps): number => total / gamesPlayed;

// A roster's weekly-style category line: what the team posts in a typical game
// when everyone on `lines` plays. Players with no games add nothing.
type TeamCategoryTotalsProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  lines: readonly ValuationLine<K>[];
};

export const teamCategoryTotals = <K extends SportKeys>({
  sport,
  lines,
}: TeamCategoryTotalsProps<K>): TeamCategoryTotal<K>[] => {
  const played = lines.filter((line) => line.gamesPlayed > 0);
  const sumPerGame = (stat: K["valued"]): number =>
    played.reduce(
      (sum, line) => sum + perGame({ total: line.stats[stat], gamesPlayed: line.gamesPlayed }),
      0,
    );
  return sport.categoryOrder.map((category): TeamCategoryTotal<K> => {
    const def = categoryDef({ sport, category });
    if (def.kind === "counting") {
      return { key: category, direction: def.direction, value: sumPerGame(def.stat) };
    }
    const volume = sumPerGame(def.denominator);
    return {
      key: category,
      direction: def.direction,
      value: volume > 0 ? (def.scale * sumPerGame(def.numerator)) / volume : 0,
    };
  });
};
