"use client";

import { useMemo } from "react";
import { parseAsStringLiteral, useQueryStates } from "nuqs";

import {
  ADVANCED_VIEW_COLUMNS,
  DATE_COLUMN,
  fantasyViewColumns,
  GAME_LOG_SORT_KEYS,
  REGULAR_COLUMNS,
  type AdvancedGameLogRow,
  type CategoryColumn,
  type FantasyGameLogRow,
  type GameLogColumn,
  type GameLogRow,
} from "@/components/PlayerGameLogTable/gameLogColumns";
import { Disclosure } from "@vision/ui/components/Disclosure/Disclosure";

import styles from "@/components/PlayerGameLogTable/PlayerGameLogTable.module.scss";

// Which view's columns follow the shared game columns: the box score, each
// game's advanced metrics, or each game's fantasy value (over the league's
// included categories, in table order). Each view's rows carry what its
// columns read.
export type PlayerGameLogTableProps =
  | { view: "regular"; rows: readonly GameLogRow[] }
  | { view: "advanced"; rows: readonly AdvancedGameLogRow[] }
  | {
      view: "fantasy";
      rows: readonly FantasyGameLogRow[];
      categories: readonly CategoryColumn[];
    };

type SortDirection = "asc" | "desc";

const SORT_DIRECTIONS: readonly SortDirection[] = ["asc", "desc"];

const sortParsers = {
  sort: parseAsStringLiteral(GAME_LOG_SORT_KEYS),
  dir: parseAsStringLiteral(SORT_DIRECTIONS),
};

// Missing values sink to the bottom in both directions: a game with no
// advanced row is not the lowest net rating, it has none.
type SortRowsProps<Row> = {
  rows: readonly Row[];
  column: GameLogColumn<Row>;
  direction: SortDirection;
};

const sortRows = <Row,>({ rows, column, direction }: SortRowsProps<Row>): Row[] =>
  [...rows].sort((left, right) => {
    const leftValue = column.value(left);
    const rightValue = column.value(right);
    if (leftValue === null || rightValue === null) {
      return leftValue === rightValue ? 0 : leftValue === null ? 1 : -1;
    }
    const result =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
    return direction === "asc" ? result : -result;
  });

type GameLogTableProps<Row extends GameLogRow> = {
  rows: readonly Row[];
  columns: readonly GameLogColumn<Row>[];
};

function GameLogTable<Row extends GameLogRow>({ rows, columns }: GameLogTableProps<Row>) {
  const [{ sort, dir }, setSorting] = useQueryStates(sortParsers);
  // A sort picked on another view may name a column this one lacks; the log
  // then reads newest-first rather than in no particular order.
  const pickedColumn = columns.find((column) => column.key === sort);
  const sortColumn: GameLogColumn<Row> = pickedColumn ?? DATE_COLUMN;
  const sortDirection: SortDirection = pickedColumn === undefined ? "desc" : (dir ?? "desc");
  const sortedRows = useMemo(
    () => sortRows({ rows, column: sortColumn, direction: sortDirection }),
    [rows, sortColumn, sortDirection],
  );

  type SortByProps = { key: string };

  const sortBy = ({ key }: SortByProps) => {
    if (key === sortColumn.key) {
      void setSorting({ sort: key, dir: sortDirection === "asc" ? "desc" : "asc" });
      return;
    }
    void setSorting({ sort: key, dir: key === DATE_COLUMN.key ? "desc" : "asc" });
  };

  // Always the last block on the page, whichever view is showing; the
  // disclosure lets a reader fold eighty rows away once the charts have said
  // their piece. Native <details> keeps it keyboard-operable for free.
  return (
    <Disclosure
      className={styles.section}
      summaryClassName={styles.summary}
      open
      summary={
        <>
          <h2 className={styles.title}>Game log</h2>
          <span className={styles.count}>
            {rows.length} {rows.length === 1 ? "game" : "games"}
          </span>
        </>
      }
    >
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => {
                const isActive = column.key === sortColumn.key;
                const ariaSort = isActive
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    data-align={column.align}
                    data-sort-active={isActive || undefined}
                  >
                    <button
                      type="button"
                      className={styles.sortButton}
                      title={column.title}
                      onClick={() => sortBy({ key: column.key })}
                    >
                      {column.label}
                      <span aria-hidden="true">
                        {isActive ? (sortDirection === "asc" ? " ↑" : " ↓") : " ↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => {
                  const value = column.value(row);
                  return (
                    <td
                      key={column.key}
                      data-align={column.align}
                      data-sort-active={column.key === sortColumn.key || undefined}
                      data-negative={
                        (!!column.signed && typeof value === "number" && value < 0) || undefined
                      }
                    >
                      {column.render?.(row) ?? value ?? "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Disclosure>
  );
}

type FantasyGameLogTableProps = {
  rows: readonly FantasyGameLogRow[];
  categories: readonly CategoryColumn[];
};

function FantasyGameLogTable({ rows, categories }: FantasyGameLogTableProps) {
  const columns = useMemo(() => fantasyViewColumns({ categories }), [categories]);
  return <GameLogTable rows={rows} columns={columns} />;
}

// Every game behind the player page's view, sortable by any column the view
// shows. The sort lives in the URL (`?sort=pts&dir=asc`).
export function PlayerGameLogTable(props: PlayerGameLogTableProps) {
  if (props.view === "advanced") {
    return <GameLogTable rows={props.rows} columns={ADVANCED_VIEW_COLUMNS} />;
  }
  if (props.view === "fantasy") {
    return <FantasyGameLogTable rows={props.rows} categories={props.categories} />;
  }
  return <GameLogTable rows={props.rows} columns={REGULAR_COLUMNS} />;
}
