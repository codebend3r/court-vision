export type SortDirection = "asc" | "desc";

// The column a table is sorted on and which way, or null for the table's own
// order (the one the panel was built to show).
export type SortState = { key: string; dir: SortDirection } | null;

export type SortValue = number | string | null;

export type SortColumn<Row> = {
  key: string;
  // The direction a first click sorts: names and ranks read from the top down
  // (asc), a stat from its best (desc).
  firstDir: SortDirection;
  valueOf: (row: Row) => SortValue;
};

/**
 * One click cycles a column: its first direction, the opposite, then back to
 * the table's own order. Another column starts at its own first direction.
 */
export const nextSort = ({
  current,
  key,
  firstDir,
}: {
  current: SortState;
  key: string;
  firstDir: SortDirection;
}): SortState => {
  if (current === null || current.key !== key) return { key, dir: firstDir };
  if (current.dir === firstDir) return { key, dir: firstDir === "asc" ? "desc" : "asc" };
  return null;
};

// Numbers by size, text alphabetically; a number sorts before text.
const compareValues = ({ a, b }: { a: number | string; b: number | string }): number => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  return typeof a === "number" ? -1 : 1;
};

/**
 * The rows ordered by a column. A row with no value sinks to the bottom either
 * way, and ties keep the order they came in, so a sort never reshuffles.
 */
export const sortRows = <Row>({
  rows,
  sort,
  columns,
}: {
  rows: readonly Row[];
  sort: SortState;
  columns: readonly SortColumn<Row>[];
}): Row[] => {
  const column = sort === null ? undefined : columns.find((entry) => entry.key === sort.key);
  if (sort === null || column === undefined) return [...rows];
  const sign = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: column.valueOf(row) }))
    .toSorted((a, b) => {
      if (a.value === null || b.value === null) {
        if (a.value === b.value) return a.index - b.index;
        return a.value === null ? 1 : -1;
      }
      return compareValues({ a: a.value, b: b.value }) * sign || a.index - b.index;
    })
    .map(({ row }) => row);
};

export const ariaSortFor = ({
  sort,
  key,
}: {
  sort: SortState;
  key: string;
}): "ascending" | "descending" | undefined => {
  if (sort === null || sort.key !== key) return undefined;
  return sort.dir === "asc" ? "ascending" : "descending";
};
