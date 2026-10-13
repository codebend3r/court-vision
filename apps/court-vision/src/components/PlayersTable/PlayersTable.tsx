import Link from "next/link";
import { type ReactNode } from "react";

import { LinkPending } from "@vision/ui/components/LinkPending/LinkPending";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PositionTag } from "@/components/PositionTag/PositionTag";
import { RosteredMarker } from "@/components/RosteredMarker/RosteredMarker";
import { StarButton } from "@/components/StarButton/StarButton";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { formatRate } from "@vision/core/util/format";
import { ADVANCED_STAT_META, type AdvancedStatMeta } from "@/lib/players/advancedStatMeta";
import { type PlayerIdentity } from "@/lib/players/identity";
import { isNameSort } from "@/lib/players/rank";
import { type CountingSortKey, type PlayerPoolRow } from "@/lib/players/search";
import { type AdvancedPlayerRow } from "@/lib/players/searchAdvanced";
import {
  buildPlayersHref,
  type AdvancedSortKey,
  type PlayerSortKey,
  type PlayerStatMode,
  type PlayersSearchParams,
  type SortDirection,
} from "@/lib/players/searchParams";

import styles from "@/components/PlayersTable/PlayersTable.module.scss";

const formatPerGame = ({ total, gamesPlayed }: { total: number; gamesPlayed: number }): string =>
  gamesPlayed > 0 ? (total / gamesPlayed).toFixed(1) : "—";

const formatPercentage = ({ made, attempted }: { made: number; attempted: number }): string =>
  attempted > 0 ? formatRate({ value: made / attempted }) : "—";

// Each stat column pairs its sort key with how to read the value, so the
// header link and the body cell always agree on which column is highlighted.
// `meta` gives a column its header tooltip and spoken full name.
export type StatColumn<Row> = {
  label: string;
  sortKey: PlayerSortKey | AdvancedSortKey;
  meta?: AdvancedStatMeta;
  cell: (row: Row) => string;
};

// The regular table's columns. Counting stats read per game or as totals, per
// the stat mode; games played and the percentages read the same either way.
export const regularColumns = ({
  mode,
}: {
  mode: PlayerStatMode;
}): readonly StatColumn<PlayerPoolRow>[] => {
  const counting = ({
    label,
    key,
  }: {
    label: string;
    key: CountingSortKey;
  }): StatColumn<PlayerPoolRow> => ({
    label,
    sortKey: key,
    cell: ({ stats }) =>
      mode === "total"
        ? String(stats[key])
        : formatPerGame({ total: stats[key], gamesPlayed: stats.gamesPlayed }),
  });
  return [
    { label: "GP", sortKey: "gamesPlayed", cell: ({ stats }) => String(stats.gamesPlayed) },
    counting({ label: "PTS", key: "pts" }),
    counting({ label: "REB", key: "reb" }),
    counting({ label: "AST", key: "ast" }),
    counting({ label: "STL", key: "stl" }),
    counting({ label: "BLK", key: "blk" }),
    counting({ label: "FGM", key: "fgm" }),
    counting({ label: "FGA", key: "fga" }),
    counting({ label: "3PM", key: "fg3m" }),
    counting({ label: "3PA", key: "fg3a" }),
    {
      label: "FG%",
      sortKey: "fgPct",
      cell: ({ stats }) => formatPercentage({ made: stats.fgm, attempted: stats.fga }),
    },
    {
      label: "3P%",
      sortKey: "fg3Pct",
      cell: ({ stats }) => formatPercentage({ made: stats.fg3m, attempted: stats.fg3a }),
    },
    {
      label: "FT%",
      sortKey: "ftPct",
      cell: ({ stats }) => formatPercentage({ made: stats.ftm, attempted: stats.fta }),
    },
    counting({ label: "TOV", key: "tov" }),
  ];
};

// Share-style metrics (TS%, USG%, PIE, the rebound shares) are fractions and
// display like FG%; ratings and ratios read to one decimal. The kind lives on
// the shared meta so the player page formats the same metric the same way.
const formatAdvancedMetric = ({
  meta,
  value,
}: {
  meta: AdvancedStatMeta;
  value: number | null;
}): string => {
  if (value === null) return "—";
  return meta.kind === "percentage" ? formatRate({ value }) : value.toFixed(1);
};

export const ADVANCED_COLUMNS: readonly StatColumn<AdvancedPlayerRow>[] = ADVANCED_STAT_META.map(
  (meta) => ({
    label: meta.label,
    sortKey: meta.key,
    meta,
    cell: (row) => formatAdvancedMetric({ meta, value: row.stats[meta.key] }),
  }),
);

// The consolidated player cell (spec §7): avatar, then name over team chip +
// position tag. Replaces the old First name / Last name / Team / Position
// quartet — which is where the horizontal room for stats comes from.
function PlayerCell({ row }: { row: PlayerIdentity }) {
  return (
    <span className={styles.playerInner}>
      <PlayerAvatar
        fullName={row.fullName}
        nbaPersonId={row.nbaPersonId}
        size="sm"
        teamAbbr={row.teamAbbr}
      />
      <span className={styles.playerMeta}>
        <Link href={`/players/${row.id}`} className={styles.playerName}>
          {row.fullName}
        </Link>
        <RosteredMarker playerId={row.id} />
        <span className={styles.playerTags}>
          {!!row.teamAbbr && <TeamChip team={row.teamAbbr} size="sm" />}
          {!!row.position && <PositionTag position={row.position} className={styles.position} />}
        </span>
      </span>
    </span>
  );
}

export type PlayersTableProps<Row extends PlayerIdentity> = {
  rows: readonly Row[];
  columns: readonly StatColumn<Row>[];
  params: PlayersSearchParams;
  page: number;
  isSignedIn: boolean;
  // Footer bar rendered inside the table wrapper (the pager).
  footer?: ReactNode;
};

export function PlayersTable<Row extends PlayerIdentity>({
  rows,
  columns,
  params,
  page,
  isSignedIn,
  footer,
}: PlayersTableProps<Row>) {
  const nextDir = ({ sortKey }: { sortKey: PlayerSortKey | AdvancedSortKey }): SortDirection =>
    params.sort === sortKey ? (params.dir === "desc" ? "asc" : "desc") : "desc";

  // The one player column sorts by last name; a first-name sort (via URL)
  // still highlights it as the active column. Rank only means something when
  // the rows are ordered by a stat.
  const isPlayerSort = isNameSort(params.sort);

  const renderSortableHeader = ({
    label,
    sortKey,
    meta,
    isStatColumn = false,
  }: {
    label: string;
    sortKey: PlayerSortKey | AdvancedSortKey;
    meta?: AdvancedStatMeta;
    isStatColumn?: boolean;
  }) => {
    const isActive = params.sort === sortKey;
    const tipId = meta && `stat-tip-${meta.key}`;
    const dir = nextDir({ sortKey });
    const announcement = `Sorting by ${meta?.fullName ?? label}, ${dir === "asc" ? "ascending" : "descending"}`;
    return (
      <th
        key={sortKey}
        // Stat headers right-align their link. Marked explicitly rather than by
        // column position: the star column shifts every index by one, and only
        // for signed-in users.
        className={isStatColumn ? styles.statHeader : styles.player}
        aria-sort={isActive ? (params.dir === "asc" ? "ascending" : "descending") : undefined}
        data-sort-active={(isStatColumn ? isActive : isPlayerSort) || undefined}
      >
        <Link
          href={buildPlayersHref({ ...params, page: 1, sort: sortKey, dir })}
          // A sort only changes search params on this same force-dynamic route,
          // so a prefetch has nothing reusable to fetch, yet each one still runs
          // the auth proxy, for every header in view.
          prefetch={false}
          className={styles.sortLink}
          data-active={isActive ? "true" : "false"}
          aria-describedby={tipId}
        >
          {label}
          {isActive && <span aria-hidden="true">{params.dir === "asc" ? " ▲" : " ▼"}</span>}
          <LinkPending announcement={announcement} />
        </Link>
        {!!meta && (
          // `hidden` keeps the bubble out of the header's accessible name; the
          // hover/focus CSS (author origin) overrides the UA display:none.
          <span role="tooltip" id={tipId} className={styles.headerTip} hidden>
            <span className={styles.headerTipName}>
              {meta.label} — {meta.fullName}
            </span>
            <span>{meta.description}</span>
            <span className={styles.headerTipFormula}>{meta.formula}</span>
          </span>
        )}
      </th>
    );
  };

  return (
    <div className={styles.tableWrapper}>
      <div className={styles.tableScroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              {/* The star column has no visible header: the buttons name
                  themselves, and a visible "Watchlist" label would cost a
                  column of width on every row. Signed out there is no
                  watchlist to act on, and 50 icon-only sign-in links would be
                  pure tab-order noise, so the column is omitted entirely. */}
              {isSignedIn && (
                <th className={styles.starColumn}>
                  <span className={styles.visuallyHidden}>Watchlist</span>
                </th>
              )}
              {!isPlayerSort && (
                <th className={styles.numeric} title="Rank in the current sort">
                  #
                </th>
              )}
              {renderSortableHeader({ label: "Player", sortKey: "lastName" })}
              {columns.map((column) =>
                renderSortableHeader({
                  label: column.label,
                  sortKey: column.sortKey,
                  meta: column.meta,
                  isStatColumn: true,
                }),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                {isSignedIn && (
                  <td className={styles.starCell}>
                    <StarButton playerId={row.id} fullName={row.fullName} isSignedIn />
                  </td>
                )}
                {!isPlayerSort && (
                  <td className={`${styles.numeric} ${styles.rank}`}>
                    {(page - 1) * params.size + index + 1}
                  </td>
                )}
                <td className={styles.player} data-sort-active={isPlayerSort || undefined}>
                  <PlayerCell row={row} />
                </td>
                {columns.map((column) => (
                  <td
                    key={column.sortKey}
                    className={styles.numeric}
                    data-sort-active={params.sort === column.sortKey || undefined}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
