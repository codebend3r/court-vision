import { type ReactNode } from "react";

import { TeamMatchup } from "@/components/TeamMatchup/TeamMatchup";
import { ADVANCED_STAT_META, formatAdvancedStat } from "@/lib/players/advancedStatMeta";
import { type AdvancedMetricKey } from "@/lib/players/searchParams";
import { CATEGORY_META } from "@vision/sport-basketball/engine";
import { type CategoryMeta, type FantasyGameValue } from "@vision/sport-basketball/types";
import { formatSigned } from "@vision/core/util/format";
import { ROLLING_WINDOW_GAMES } from "@vision/core/valuation/rolling";

import styles from "@/components/PlayerGameLogTable/PlayerGameLogTable.module.scss";

// One game of the player's log: the box score every view shows.
export type GameLogRow = {
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
};

// The advanced view's row: the game's advanced metrics, null when the game
// has no advanced row.
export type AdvancedGameLogRow = GameLogRow & {
  advanced: Record<AdvancedMetricKey, number | null> | null;
};

// The fantasy view's row: the game's fantasy value, null when it has none.
export type FantasyGameLogRow = GameLogRow & { fantasy: FantasyGameValue | null };

export type CategoryColumn = Pick<CategoryMeta, "key" | "label">;

type SortValue = number | string | null;

export type GameLogColumn<Row> = {
  key: string;
  label: string;
  // The column's full name, shown on hover over its header.
  title?: string;
  align?: "left" | "right";
  // What the column sorts by; null sinks to the bottom either way.
  value: (row: Row) => SortValue;
  render?: (row: Row) => ReactNode;
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
  value === null ? "—" : formatSigned({ value, digits: 0 });

const formatScore = (value: number | null): string =>
  value === null ? "—" : formatSigned({ value, digits: 1 });

// The log's default order, newest first, and the fallback when the URL sorts
// by a column the current view lacks. Every view leads with it.
export const DATE_COLUMN: GameLogColumn<GameLogRow> = {
  key: "gameDate",
  label: "Date",
  value: ({ gameDate }) => gameDate,
  render: ({ gameDate }) => formatDate(gameDate),
};

// The game itself, first on every view.
const GAME_COLUMNS: readonly GameLogColumn<GameLogRow>[] = [
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
  DATE_COLUMN,
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

type BoxStatKey = Exclude<keyof GameLogRow, "id" | "gameDate" | "matchup" | "winLoss">;

const boxColumn = ({
  key,
  label,
}: {
  key: BoxStatKey;
  label: string;
}): GameLogColumn<GameLogRow> => ({
  key,
  label,
  align: "right",
  value: (row) => row[key],
});

const BOX_COLUMNS: readonly GameLogColumn<GameLogRow>[] = [
  boxColumn({ key: "pts", label: "PTS" }),
  boxColumn({ key: "fgm", label: "FGM" }),
  boxColumn({ key: "fga", label: "FGA" }),
  boxColumn({ key: "fg3m", label: "3PM" }),
  boxColumn({ key: "fg3a", label: "3PA" }),
  boxColumn({ key: "ftm", label: "FTM" }),
  boxColumn({ key: "fta", label: "FTA" }),
  boxColumn({ key: "oreb", label: "OREB" }),
  boxColumn({ key: "dreb", label: "DREB" }),
  boxColumn({ key: "reb", label: "REB" }),
  boxColumn({ key: "ast", label: "AST" }),
  boxColumn({ key: "stl", label: "STL" }),
  boxColumn({ key: "blk", label: "BLK" }),
  boxColumn({ key: "tov", label: "TOV" }),
  {
    key: "plusMinus",
    label: "+/-",
    align: "right",
    value: ({ plusMinus }) => plusMinus,
    render: ({ plusMinus }) => formatPlusMinus(plusMinus),
  },
];

// Every metric the advanced view charts, in the same order as its legend.
const ADVANCED_COLUMNS: readonly GameLogColumn<AdvancedGameLogRow>[] = ADVANCED_STAT_META.map(
  (meta): GameLogColumn<AdvancedGameLogRow> => ({
    key: meta.key,
    label: meta.label,
    title: meta.fullName,
    align: "right",
    value: (row) => row.advanced?.[meta.key] ?? null,
    render: (row) => formatAdvancedStat({ key: meta.key, value: row.advanced?.[meta.key] ?? null }),
  }),
);

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
}): GameLogColumn<FantasyGameLogRow> => {
  const value = ({ fantasy }: FantasyGameLogRow): number | null =>
    fantasy === null ? null : pick(fantasy);
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

const categoryScoreKey = ({ key }: { key: CategoryColumn["key"] }): string => `${key}-z`;

const FANTASY_VALUE_COLUMNS: readonly GameLogColumn<FantasyGameLogRow>[] = [
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
];

export const REGULAR_COLUMNS: readonly GameLogColumn<GameLogRow>[] = [
  ...GAME_COLUMNS,
  ...BOX_COLUMNS,
];

export const ADVANCED_VIEW_COLUMNS: readonly GameLogColumn<AdvancedGameLogRow>[] = [
  ...GAME_COLUMNS,
  ...ADVANCED_COLUMNS,
];

// The fantasy view's three readings of each game: its own value, the rolling
// value ending at it (the trend chart's line), and each category's Z (the
// breakdown chart's bars, one game at a time).
export const fantasyViewColumns = ({
  categories,
}: {
  categories: readonly CategoryColumn[];
}): GameLogColumn<FantasyGameLogRow>[] => [
  ...GAME_COLUMNS,
  ...FANTASY_VALUE_COLUMNS,
  ...categories.map((category) =>
    scoreColumn({
      key: categoryScoreKey({ key: category.key }),
      label: `${category.label} Z`,
      title: `${CATEGORY_META.find((meta) => meta.key === category.key)?.fullName ?? category.label} Z-Score for this game`,
      pick: (fantasy) => fantasy.categories[category.key] ?? null,
    }),
  ),
];

// Every column key any view can sort by: what `?sort=` accepts.
export const GAME_LOG_SORT_KEYS: readonly string[] = [
  ...REGULAR_COLUMNS,
  ...ADVANCED_COLUMNS,
  ...FANTASY_VALUE_COLUMNS,
]
  .map((column) => column.key)
  .concat(CATEGORY_META.map((meta) => categoryScoreKey({ key: meta.key })));
