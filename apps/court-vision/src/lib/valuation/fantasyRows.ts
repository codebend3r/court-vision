import { isNameSort, rankRows, type NamedRow, type Page, type RankOrder } from "@/lib/players/rank";
import { type SortDirection } from "@/lib/players/searchParams";
import { VALUE_KEY_BY_SORT } from "@vision/core/valuation/registry";
import { type FantasySortKey } from "@/lib/valuation/searchParams";
import { type FantasyPlayerValues } from "@vision/core/valuation/types";
import { type FantasyStatLine } from "@/lib/valuation/types";

// One row of every Fantasy layout: the stat line, every method's score, and
// its place in the current order.
export type FantasyTableRow = FantasyStatLine & { values: FantasyPlayerValues; rank: number };

// What every Fantasy layout (the table and both chart lists) reads to order
// its rows, mark the sorted column, and offer the star column: the view hands
// the one object to whichever layout is showing.
type OnSortProps = { sort: FantasySortKey };

export type ListSortProps = {
  sort: FantasySortKey;
  dir: SortDirection;
  isSignedIn: boolean;
  onSort: (args: OnSortProps) => void;
};

type ScoredLine = { line: FantasyStatLine; values: FantasyPlayerValues };

// A line the pool has no score for yet reads as exactly average.
type NeutralValuesProps = { playerId: number };

const neutralValues = ({ playerId }: NeutralValuesProps): FantasyPlayerValues => ({
  playerId,
  z: 0,
  g: 0,
  points: 0,
  vorp: 0,
  positional: 0,
  sgp: 0,
  sim: 0,
});

const nameOf = ({ line }: ScoredLine): NamedRow => ({
  id: line.playerId,
  firstName: line.firstName,
  lastName: line.lastName,
  fullName: line.fullName,
});

// Name sorts rank alphabetically; a method column ranks by the value field
// the registry names for its sort key, ties broken by player id so a page
// never reshuffles.
type OrderForProps = { sort: FantasySortKey };

const orderFor = ({ sort }: OrderForProps): RankOrder<ScoredLine> => {
  if (isNameSort(sort)) return { by: "name", sort };
  const valueKey = VALUE_KEY_BY_SORT[sort];
  return {
    by: "value",
    valueOf: ({ values }) => ({ value: values[valueKey], sink: false }),
    tiebreak: "id",
  };
};

// Pairs each line with its scores, then searches, orders and pages them the
// way every Fantasy layout lists them, numbering each row by its place in
// the whole ordered list.
type RankFantasyRowsProps = {
  lines: readonly FantasyStatLine[];
  values: readonly FantasyPlayerValues[];
  q: string;
  page: number;
  size: number;
  dir: SortDirection;
  sort: FantasySortKey;
};

export const rankFantasyRows = ({
  lines,
  values,
  q,
  page,
  size,
  dir,
  sort,
}: RankFantasyRowsProps): Page<FantasyTableRow> => {
  const byId = new Map(values.map((value) => [value.playerId, value]));
  const ranked = rankRows({
    rows: lines.map((line): ScoredLine => ({
      line,
      values: byId.get(line.playerId) ?? neutralValues({ playerId: line.playerId }),
    })),
    nameOf,
    q: q.trim(),
    page,
    size,
    dir,
    order: orderFor({ sort }),
  });
  const offset = (ranked.page - 1) * size;
  return {
    ...ranked,
    rows: ranked.rows.map(({ line, values: lineValues }, index): FantasyTableRow => ({
      ...line,
      values: lineValues,
      rank: offset + index + 1,
    })),
  };
};
