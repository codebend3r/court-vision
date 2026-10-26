import { useState } from "react";

import { nextSort, sortRows, type SortColumn, type SortState } from "@/lib/tableSort";

// One table's sort: the state, the click handler for its headers, and the
// rows put in that order. `columns` should be stable (module level or memoized).
type UseColumnSortProps<Row> = { columns: readonly SortColumn<Row>[] };

export const useColumnSort = <Row>({ columns }: UseColumnSortProps<Row>) => {
  const [sort, setSort] = useState<SortState>(null);

  type OnSortProps = { key: string };

  const onSort = ({ key }: OnSortProps) => {
    const column = columns.find((entry) => entry.key === key);
    if (column === undefined) return;
    setSort((current) => nextSort({ current, key, firstDir: column.firstDir }));
  };

  return {
    sort,
    onSort,
    sorted: (rows: readonly Row[]): Row[] => sortRows({ rows, sort, columns }),
  };
};
