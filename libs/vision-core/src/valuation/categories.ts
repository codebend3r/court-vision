import {
  type Category,
  type CategoryDef,
  type RatioCategoryDef,
  type SportDescriptor,
  type SportKeys,
} from "#core/sport/types";
import { isKeyOf } from "#core/util/record";
import { type Basis, type ValuationLine } from "#core/valuation/types";

export type CategoryKind = "counting" | "ratio";

export type CategoryMeta<K extends SportKeys> = {
  key: Category<K>;
  label: string;
  fullName: string;
  description: string;
  formula: string;
  kind: CategoryKind;
};

// A sport's category definition, whichever kind it is. Unknown keys throw:
// every caller holds a key the descriptor's own types produced.
export const categoryDef = <K extends SportKeys>({
  sport,
  category,
}: {
  sport: SportDescriptor<K>;
  category: Category<K>;
}): CategoryDef<K> => {
  if (isKeyOf({ record: sport.counting })(category)) return sport.counting[category];
  if (isKeyOf({ record: sport.ratio })(category)) return sport.ratio[category];
  throw new Error(`${sport.id} has no category "${category}"`);
};

// The sport's ratio categories in category order: the ones that carry a
// league rate and a cross moment.
export const ratioDefs = <K extends SportKeys>({
  sport,
}: {
  sport: SportDescriptor<K>;
}): RatioCategoryDef<K>[] =>
  sport.categoryOrder.flatMap((category) => {
    const def = categoryDef({ sport, category });
    return def.kind === "ratio" ? [def] : [];
  });

// Table metadata in the sport's category order.
export const categoryMeta = <K extends SportKeys>({
  sport,
}: {
  sport: SportDescriptor<K>;
}): CategoryMeta<K>[] =>
  sport.categoryOrder.map((category) => {
    const def = categoryDef({ sport, category });
    return {
      key: category,
      label: def.label,
      fullName: def.fullName,
      description: def.description,
      formula: def.formula,
      kind: def.kind,
    };
  });

export const categoryGuard =
  <K extends SportKeys>({ sport }: { sport: SportDescriptor<K> }) =>
  (value: string): value is Category<K> =>
    sport.categoryOrder.some((key) => key === value);

const perBasis = ({
  total,
  gamesPlayed,
  basis,
}: {
  total: number;
  gamesPlayed: number;
  basis: Basis;
}): number => {
  if (basis === "total") return total;
  return gamesPlayed > 0 ? total / gamesPlayed : 0;
};

// The single per-category primitive: counting totals and volume-weighted ratio
// impacts (PRD §5.3), both sign-corrected so every downstream number reads
// higher-is-better. Zero volume is neutral, never a divide by zero.
export const categoryValue = <K extends SportKeys>({
  sport,
  line,
  category,
  basis,
  leagueRate,
}: {
  sport: SportDescriptor<K>;
  line: ValuationLine<K>;
  category: Category<K>;
  basis: Basis;
  leagueRate: Record<K["ratio"], number>;
}): number => {
  const def = categoryDef({ sport, category });
  if (def.kind === "counting") {
    const total = line.stats[def.stat];
    const signed = def.direction === "lower" ? -total : total;
    return perBasis({ total: signed, gamesPlayed: line.gamesPlayed, basis });
  }
  const volume = line.stats[def.denominator];
  if (volume === 0) return 0;
  const rate = (def.scale * line.stats[def.numerator]) / volume;
  const impact = volume * (rate - def.scale * leagueRate[def.key]);
  const signed = def.direction === "lower" ? -impact : impact;
  return perBasis({ total: signed, gamesPlayed: line.gamesPlayed, basis });
};

// Human-readable per-game value for display beside a category's score.
// Counting stats stay positive (a lower-is-better sign lives in its z), ratio
// stats become the underlying scaled rate.
export const categoryPerGame = <K extends SportKeys>({
  sport,
  line,
  category,
}: {
  sport: SportDescriptor<K>;
  line: ValuationLine<K>;
  category: Category<K>;
}): number => {
  const def = categoryDef({ sport, category });
  if (def.kind === "ratio") {
    const volume = line.stats[def.denominator];
    return volume > 0 ? (def.scale * line.stats[def.numerator]) / volume : 0;
  }
  const total = line.stats[def.stat];
  return line.gamesPlayed > 0 ? total / line.gamesPlayed : 0;
};
