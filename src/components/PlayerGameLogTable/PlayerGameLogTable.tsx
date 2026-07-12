"use client";

import { useMemo, type ReactNode } from "react";
import { parseAsString, useQueryStates } from "nuqs";

import { TeamMatchup } from "@/components/TeamMatchup/TeamMatchup";

import styles from "@/components/PlayerGameLogTable/PlayerGameLogTable.module.scss";

export type PlayerGameLogTableRow = {
  id: string;
  gameDate: string;
  matchup: string;
  winLoss: string | null;
  teamScore: number | null;
  opponentScore: number | null;
  minutes: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pts: number;
  plusMinus: number | null;
};

type SortKey = Exclude<keyof PlayerGameLogTableRow, "id">;
type SortDirection = "asc" | "desc";

type Column = {
  key: SortKey;
  label: string;
  align?: "left" | "right";
  render?: (row: PlayerGameLogTableRow) => ReactNode;
};

const formatDate = (isoDate: string): string =>
  new Date(isoDate).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });

const formatPlusMinus = (value: number | null): string =>
  value === null ? "—" : value > 0 ? `+${value}` : String(value);

const COLUMNS: readonly Column[] = [
  { key: "gameDate", label: "Date", render: ({ gameDate }) => formatDate(gameDate) },
  {
    key: "matchup",
    label: "Matchup",
    render: ({ matchup }) => <TeamMatchup matchup={matchup} size="sm" />,
  },
  {
    key: "winLoss",
    label: "Result",
    render: ({ winLoss, teamScore, opponentScore }) => {
      const score =
        teamScore !== null && opponentScore !== null ? `${teamScore}-${opponentScore}` : null;
      if (winLoss !== "W" && winLoss !== "L") {
        return winLoss ?? "—";
      }
      return (
        <>
          <span className={winLoss === "W" ? styles.win : styles.loss}>{winLoss}</span>
          {!!score && <span className={styles.score}> {score}</span>}
        </>
      );
    },
  },
  { key: "minutes", label: "MIN", align: "right" },
  { key: "pts", label: "PTS", align: "right" },
  { key: "fgm", label: "FGM", align: "right" },
  { key: "fga", label: "FGA", align: "right" },
  { key: "fg3m", label: "3PM", align: "right" },
  { key: "fg3a", label: "3PA", align: "right" },
  { key: "ftm", label: "FTM", align: "right" },
  { key: "fta", label: "FTA", align: "right" },
  { key: "oreb", label: "OREB", align: "right" },
  { key: "dreb", label: "DREB", align: "right" },
  { key: "reb", label: "REB", align: "right" },
  { key: "ast", label: "AST", align: "right" },
  { key: "stl", label: "STL", align: "right" },
  { key: "blk", label: "BLK", align: "right" },
  { key: "tov", label: "TOV", align: "right" },
  {
    key: "plusMinus",
    label: "+/-",
    align: "right",
    render: ({ plusMinus }) => formatPlusMinus(plusMinus),
  },
];

const SORT_KEYS = new Set<SortKey>(COLUMNS.map((column) => column.key));

const isSortKey = (value: string | null): value is SortKey =>
  value !== null && SORT_KEYS.has(value as SortKey);

const compare = (
  left: PlayerGameLogTableRow,
  right: PlayerGameLogTableRow,
  key: SortKey,
): number => {
  const leftValue = left[key];
  const rightValue = right[key];

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return leftValue - rightValue;
  }
  if (leftValue === null || rightValue === null) {
    return leftValue === rightValue ? 0 : leftValue === null ? 1 : -1;
  }
  return String(leftValue).localeCompare(String(rightValue));
};

export function PlayerGameLogTable({ rows }: { rows: PlayerGameLogTableRow[] }) {
  const [{ sort, dir }, setSorting] = useQueryStates({
    sort: parseAsString,
    dir: parseAsString,
  });
  const sortKey: SortKey = isSortKey(sort) ? sort : "gameDate";
  const sortDirection: SortDirection = dir === "asc" ? "asc" : "desc";
  const sortedRows = useMemo(
    () =>
      [...rows].sort((left, right) => {
        const result = compare(left, right, sortKey);
        return sortDirection === "asc" ? result : -result;
      }),
    [rows, sortDirection, sortKey],
  );

  const sortBy = (key: SortKey) => {
    if (key === sortKey) {
      void setSorting({ sort: key, dir: sortDirection === "asc" ? "desc" : "asc" });
      return;
    }
    void setSorting({ sort: key, dir: key === "gameDate" ? "desc" : "asc" });
  };

  return (
    <section className={styles.section} aria-labelledby="game-log-title">
      <h2 id="game-log-title" className={styles.title}>
        Game log
      </h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((column) => {
                const isActive = column.key === sortKey;
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
                      onClick={() => sortBy(column.key)}
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
                {COLUMNS.map((column) => (
                  <td
                    key={column.key}
                    data-align={column.align}
                    data-sort-active={column.key === sortKey || undefined}
                  >
                    {column.render?.(row) ?? row[column.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
