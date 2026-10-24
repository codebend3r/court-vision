import { useState } from "react";

import { nextSort, sortRows, type SortColumn, type SortState } from "@/lib/tableSort";

// One table's sort: the state, the click handler for its headers, and the
// rows put in that order. `columns` should be stable (module level or memoized).
export const useColumnSort = <Row>({ columns }: { columns: readonly SortColumn<Row>[] }) => {
  const [sort, setSort] = useState<SortState>(null);

  const onSort = ({ key }: { key: string }) => {
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
