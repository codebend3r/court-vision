"use client";

import { useMemo, type ReactNode } from "react";
import { parseAsString, useQueryStates } from "nuqs";

import { formatSigned } from "@/components/PlayerFantasyChart/breakdownChart";
import { TeamMatchup } from "@/components/TeamMatchup/TeamMatchup";
import { ADVANCED_STAT_META, formatAdvancedStat } from "@/lib/players/advancedStatMeta";
import { type AdvancedMetricKey } from "@/lib/players/searchParams";
import { type PlayerView } from "@/lib/stats/searchParams";
import { CATEGORY_META, type CategoryMeta } from "@/lib/valuation/categories";
import { type FantasyGameValue } from "@/lib/valuation/gameValues";
import { ROLLING_WINDOW_GAMES } from "@/lib/watchlist/trend";

import styles from "@/components/PlayerGameLogTable/PlayerGameLogTable.module.scss";

export type PlayerGameLogTableRow = {
  id: string;
  gameNumber: number;
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
  // The game's advanced metrics, for the advanced view; null when the game
  // has no advanced row.
  advanced?: Record<AdvancedMetricKey, number | null> | null;
  // The game's fantasy value, for the fantasy view.
  fantasy?: FantasyGameValue | null;
};

type CategoryColumn = Pick<CategoryMeta, "key" | "label">;

export type PlayerGameLogTableProps = {
  rows: PlayerGameLogTableRow[];
  // Which view's columns follow the shared game columns: the box score, each
  // game's advanced metrics, or each game's fantasy value.
  view?: PlayerView;
  // The fantasy view's included categories, in table order.
  categories?: readonly CategoryColumn[];
};

type SortDirection = "asc" | "desc";
type SortValue = number | string | null;

type Column = {
  key: string;
  label: string;
  // The column's full name, shown on hover over its header.
  title?: string;
  align?: "left" | "right";
  // What the column sorts by; null sinks to the bottom either way.
  value: (row: PlayerGameLogTableRow) => SortValue;
  render?: (row: PlayerGameLogTableRow) => ReactNode;
  // Signed scores colour their negatives (spec §7).
  signed?: boolean;
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

const formatScore = (value: number | null): string => (value === null ? "—" : formatSigned(value));

// The game itself, first on every view.
const GAME_COLUMNS: readonly Column[] = [
  {
    key: "gameNumber",
    label: "GM",
    align: "right",
    value: ({ gameNumber }) => gameNumber,
    render: ({ gameNumber, minutes }) => (
      <span className={styles.gameNumber}>
        {gameNumber}
        {minutes === 0 && (
          <span
            className={styles.dnpDot}
            title="DNP / DNP-CD (0 MIN)"
            role="img"
            aria-label="Did not play"
          />
        )}
      </span>
    ),
  },
  {
    key: "gameDate",
    label: "Date",
    value: ({ gameDate }) => gameDate,
    render: ({ gameDate }) => formatDate(gameDate),
  },
  {
    key: "matchup",
    label: "Matchup",
    value: ({ matchup }) => matchup,
    render: ({ matchup }) => <TeamMatchup matchup={matchup} size="sm" />,
  },
  {
    key: "winLoss",
    label: "Result",
    value: ({ winLoss }) => winLoss,
    render: ({ winLoss, teamScore, opponentScore }) => {
      // typeof guards (not null checks) so rows missing the score fields
      // entirely (e.g. a Prisma client generated before the score migration)
      // degrade to a bare W/L instead of an undefined-undefined score.
      const score =
        typeof teamScore === "number" && typeof opponentScore === "number"
          ? `${teamScore}-${opponentScore}`
          : null;
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
  { key: "minutes", label: "MIN", align: "right", value: ({ minutes }) => minutes },
];

const boxColumn = (
  key: Exclude<keyof PlayerGameLogTableRow, "advanced" | "fantasy">,
  label: string,
): Column => ({
  key,
  label,
  align: "right",
  value: (row) => row[key],
});

const BOX_COLUMNS: readonly Column[] = [
  boxColumn("pts", "PTS"),
  boxColumn("fgm", "FGM"),
  boxColumn("fga", "FGA"),
  boxColumn("fg3m", "3PM"),
  boxColumn("fg3a", "3PA"),
  boxColumn("ftm", "FTM"),
  boxColumn("fta", "FTA"),
  boxColumn("oreb", "OREB"),
  boxColumn("dreb", "DREB"),
  boxColumn("reb", "REB"),
  boxColumn("ast", "AST"),
  boxColumn("stl", "STL"),
  boxColumn("blk", "BLK"),
  boxColumn("tov", "TOV"),
  {
    key: "plusMinus",
    label: "+/-",
    align: "right",
    value: ({ plusMinus }) => plusMinus,
    render: ({ plusMinus }) => formatPlusMinus(plusMinus),
  },
];

// Every metric the advanced view charts, in the same order as its legend.
const ADVANCED_COLUMNS: readonly Column[] = ADVANCED_STAT_META.map((meta): Column => ({
  key: meta.key,
  label: meta.label,
  title: meta.fullName,
  align: "right",
  value: (row) => row.advanced?.[meta.key] ?? null,
  render: (row) => formatAdvancedStat({ key: meta.key, value: row.advanced?.[meta.key] ?? null }),
}));

const scoreColumn = ({
  key,
  label,
  title,
  pick,
}: {
  key: string;
  label: string;
  title: string;
  pick: (fantasy: FantasyGameValue) => number | null;
}): Column => {
  const value = (row: PlayerGameLogTableRow): number | null =>
    row.fantasy === undefined || row.fantasy === null ? null : pick(row.fantasy);
  return {
    key,
    label,
    title,
    align: "right",
    signed: true,
    value,
    render: (row) => formatScore(value(row)),
  };
};

// The fantasy view's three readings of each game: its own value, the rolling
// value ending at it (the trend chart's line), and each category's Z (the
// breakdown chart's bars, one game at a time).
const fantasyColumns = ({ categories }: { categories: readonly CategoryColumn[] }): Column[] => [
  scoreColumn({ key: "z", label: "Z", title: "Z-Score for this game", pick: ({ z }) => z }),
  scoreColumn({ key: "g", label: "G", title: "G-Score for this game", pick: ({ g }) => g }),
  scoreColumn({
    key: "rollingZ",
    label: "Roll Z",
    title: `Z-Score over the ${ROLLING_WINDOW_GAMES} games ending here`,
    pick: ({ rollingZ }) => rollingZ,
  }),
  scoreColumn({
    key: "rollingG",
    label: "Roll G",
    title: `G-Score over the ${ROLLING_WINDOW_GAMES} games ending here`,
    pick: ({ rollingG }) => rollingG,
  }),
  ...categories.map((category) =>
    scoreColumn({
      key: `${category.key}-z`,
      label: `${category.label} Z`,
      title: `${CATEGORY_META.find((meta) => meta.key === category.key)?.fullName ?? category.label} Z-Score for this game`,
      pick: (fantasy) => fantasy.categories[category.key] ?? null,
    }),
  ),
];

const columnsFor = ({
  view,
  categories,
}: {
  view: PlayerView;
  categories: readonly CategoryColumn[];
}): readonly Column[] => {
  if (view === "advanced") return [...GAME_COLUMNS, ...ADVANCED_COLUMNS];
  if (view === "fantasy") return [...GAME_COLUMNS, ...fantasyColumns({ categories })];
  return [...GAME_COLUMNS, ...BOX_COLUMNS];
};

const DEFAULT_SORT_KEY = "gameDate";

// Missing values sink to the bottom in both directions: a game with no
// advanced row is not the lowest net rating, it has none.
const sortRows = ({
  rows,
  column,
  direction,
}: {
  rows: readonly PlayerGameLogTableRow[];
  column: Column;
  direction: SortDirection;
}): PlayerGameLogTableRow[] =>
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

export function PlayerGameLogTable({
  rows,
  view = "regular",
  categories = CATEGORY_META,
}: PlayerGameLogTableProps) {
  const [{ sort, dir }, setSorting] = useQueryStates({
    sort: parseAsString,
    dir: parseAsString,
  });
  const columns = useMemo(() => columnsFor({ view, categories }), [view, categories]);
  // A sort picked on another view may name a column this one lacks; the log
  // then reads newest-first rather than in no particular order.
  const sortColumn =
    columns.find((column) => column.key === sort) ??
    columns.find((column) => column.key === DEFAULT_SORT_KEY);
  const sortKey = sortColumn?.key ?? DEFAULT_SORT_KEY;
  const sortDirection: SortDirection =
    sortColumn?.key === sort ? (dir === "asc" ? "asc" : "desc") : "desc";
  const sortedRows = useMemo(
    () =>
      sortColumn === undefined
        ? rows
        : sortRows({ rows, column: sortColumn, direction: sortDirection }),
    [rows, sortColumn, sortDirection],
  );

  const sortBy = (key: string) => {
    if (key === sortKey) {
      void setSorting({ sort: key, dir: sortDirection === "asc" ? "desc" : "asc" });
      return;
    }
    void setSorting({ sort: key, dir: key === DEFAULT_SORT_KEY ? "desc" : "asc" });
  };

  // Always the last block on the page, whichever view is showing; the
  // disclosure lets a reader fold eighty rows away once the charts have said
  // their piece. Native <details> keeps it keyboard-operable for free.
  return (
    <details className={styles.section} open>
      <summary className={styles.summary}>
        <span className={styles.chevron} aria-hidden="true">
          ▸
        </span>
        <h2 className={styles.title}>Game log</h2>
        <span className={styles.count}>
          {rows.length} {rows.length === 1 ? "game" : "games"}
        </span>
      </summary>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => {
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
                      title={column.title}
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
                {columns.map((column) => {
                  const value = column.value(row);
                  return (
                    <td
                      key={column.key}
                      data-align={column.align}
                      data-sort-active={column.key === sortKey || undefined}
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
    </details>
  );
}
