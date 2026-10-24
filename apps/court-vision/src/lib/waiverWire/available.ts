import { formatRate } from "@vision/core/util/format";

import { type FantasyStatLine } from "@/lib/valuation/types";
import { type SortColumn } from "@/lib/tableSort";
import { type WaiverRow } from "@/lib/waiverWire/types";

const perGameValue = ({ total, line }: { total: number; line: FantasyStatLine }): number | null =>
  line.gamesPlayed > 0 ? total / line.gamesPlayed : null;

const rateValue = ({ made, attempted }: { made: number; attempted: number }): number | null =>
  attempted > 0 ? made / attempted : null;

const perGame = ({ total, line }: { total: number; line: FantasyStatLine }): string =>
  perGameValue({ total, line })?.toFixed(1) ?? "—";

const rate = ({ made, attempted }: { made: number; attempted: number }): string => {
  const value = rateValue({ made, attempted });
  return value === null ? "—" : formatRate({ value });
};

// The columns beside a free agent's name: the nine categories a league scores,
// read per game, so a player can be judged without leaving the list.
export type AvailableColumn = {
  label: string;
  cell: (line: FantasyStatLine) => string;
  // The number behind the cell, which a sort reads; null when it has none.
  sortValue: (line: FantasyStatLine) => number | null;
};

const perGameColumn = ({
  label,
  total,
}: {
  label: string;
  total: (line: FantasyStatLine) => number;
}): AvailableColumn => ({
  label,
  cell: (line) => perGame({ total: total(line), line }),
  sortValue: (line) => perGameValue({ total: total(line), line }),
});

const rateColumn = ({
  label,
  made,
  attempted,
}: {
  label: string;
  made: (line: FantasyStatLine) => number;
  attempted: (line: FantasyStatLine) => number;
}): AvailableColumn => ({
  label,
  cell: (line) => rate({ made: made(line), attempted: attempted(line) }),
  sortValue: (line) => rateValue({ made: made(line), attempted: attempted(line) }),
});

export const AVAILABLE_COLUMNS: readonly AvailableColumn[] = [
  { label: "GP", cell: (line) => String(line.gamesPlayed), sortValue: (line) => line.gamesPlayed },
  perGameColumn({ label: "PTS", total: (line) => line.stats.pts }),
  perGameColumn({ label: "REB", total: (line) => line.stats.reb }),
  perGameColumn({ label: "AST", total: (line) => line.stats.ast }),
  perGameColumn({ label: "STL", total: (line) => line.stats.stl }),
  perGameColumn({ label: "BLK", total: (line) => line.stats.blk }),
  perGameColumn({ label: "3PM", total: (line) => line.stats.fg3m }),
  rateColumn({ label: "FG%", made: (line) => line.stats.fgm, attempted: (line) => line.stats.fga }),
  rateColumn({ label: "FT%", made: (line) => line.stats.ftm, attempted: (line) => line.stats.fta }),
  perGameColumn({ label: "TOV", total: (line) => line.stats.tov }),
];

/** The Available players table's sortable columns, keyed by their header. */
export const availableSortColumns = ({
  linesById,
}: {
  linesById: ReadonlyMap<number, FantasyStatLine>;
}): SortColumn<WaiverRow>[] => [
  { key: "rank", firstDir: "asc", valueOf: (row) => row.rank },
  { key: "player", firstDir: "asc", valueOf: (row) => row.fullName },
  ...AVAILABLE_COLUMNS.map((column): SortColumn<WaiverRow> => ({
    key: column.label,
    firstDir: "desc",
    valueOf: (row) => {
      const line = linesById.get(row.playerId);
      return line === undefined ? null : column.sortValue(line);
    },
  })),
  { key: "value", firstDir: "desc", valueOf: (row) => row.value },
];

/** The free pool narrowed to names containing `q`, keeping its value order. */
export const filterAvailable = ({
  rows,
  q,
}: {
  rows: readonly WaiverRow[];
  q: string;
}): WaiverRow[] => {
  const needle = q.trim().toLowerCase();
  return needle === ""
    ? [...rows]
    : rows.filter((row) => row.fullName.toLowerCase().includes(needle));
};
