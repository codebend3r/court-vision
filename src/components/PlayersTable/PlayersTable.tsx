import Link from "next/link";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { StarButton } from "@/components/StarButton/StarButton";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { ADVANCED_STAT_META, type AdvancedStatMeta } from "@/lib/players/advancedStatMeta";
import { type PlayerRow, type PlayerStats } from "@/lib/players/search";
import { type AdvancedPlayerRow } from "@/lib/players/searchAdvanced";
import {
  buildPlayersHref,
  type AdvancedMetricKey,
  type AdvancedSortKey,
  type PlayerSortKey,
  type PlayersSearchParams,
  type SortDirection,
} from "@/lib/players/searchParams";

import styles from "@/components/PlayersTable/PlayersTable.module.scss";

const formatPerGame = (total: number, gamesPlayed: number): string =>
  gamesPlayed > 0 ? (total / gamesPlayed).toFixed(1) : "—";

const formatPercentage = (made: number, attempted: number): string =>
  attempted > 0 ? (made / attempted).toFixed(3).replace(/^0/, "") : "—";

// Each numeric column pairs its sort key with how to read the value, so the
// header link and the body cell always agree on which column is highlighted.
type StatColumn = {
  label: string;
  sortKey: PlayerSortKey;
  value: (args: { stats: PlayerStats; formatCountingStat: (value: number) => string }) => string;
};

const STAT_COLUMNS: readonly StatColumn[] = [
  { label: "GP", sortKey: "gamesPlayed", value: ({ stats }) => String(stats.gamesPlayed) },
  {
    label: "PTS",
    sortKey: "pts",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.pts),
  },
  {
    label: "REB",
    sortKey: "reb",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.reb),
  },
  {
    label: "AST",
    sortKey: "ast",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.ast),
  },
  {
    label: "STL",
    sortKey: "stl",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.stl),
  },
  {
    label: "BLK",
    sortKey: "blk",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.blk),
  },
  {
    label: "FGM",
    sortKey: "fgm",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.fgm),
  },
  {
    label: "FGA",
    sortKey: "fga",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.fga),
  },
  {
    label: "3PM",
    sortKey: "fg3m",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.fg3m),
  },
  {
    label: "3PA",
    sortKey: "fg3a",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.fg3a),
  },
  { label: "FG%", sortKey: "fgPct", value: ({ stats }) => formatPercentage(stats.fgm, stats.fga) },
  {
    label: "3P%",
    sortKey: "fg3Pct",
    value: ({ stats }) => formatPercentage(stats.fg3m, stats.fg3a),
  },
  { label: "FT%", sortKey: "ftPct", value: ({ stats }) => formatPercentage(stats.ftm, stats.fta) },
  {
    label: "TOV",
    sortKey: "tov",
    value: ({ stats, formatCountingStat }) => formatCountingStat(stats.tov),
  },
];

// TS%/eFG%/usage-style metrics are fractions (display like FG%); the rest are
// rating/ratio-style numbers (display to one decimal).
const PERCENTAGE_METRIC_KEYS: readonly AdvancedMetricKey[] = [
  "assistPercentage",
  "defensiveReboundPercentage",
  "effectiveFieldGoalPercentage",
  "offensiveReboundPercentage",
  "reboundPercentage",
  "trueShootingPercentage",
  "usagePercentage",
];

const formatAdvancedMetric = ({
  metricKey,
  value,
}: {
  metricKey: AdvancedMetricKey;
  value: number | null;
}): string => {
  if (value === null) return "—";
  return PERCENTAGE_METRIC_KEYS.includes(metricKey)
    ? value.toFixed(3).replace(/^0/, "")
    : value.toFixed(1);
};

type PlayersTableProps = {
  params: PlayersSearchParams;
  page: number;
  isSignedIn: boolean;
} & (
  | { variant: "regular"; rows: PlayerRow[] }
  | { variant: "advanced"; rows: AdvancedPlayerRow[] }
);

export function PlayersTable(props: PlayersTableProps) {
  const { params, page, isSignedIn } = props;

  const nextDir = ({ sortKey }: { sortKey: PlayerSortKey | AdvancedSortKey }): SortDirection =>
    params.sort === sortKey ? (params.dir === "desc" ? "asc" : "desc") : "desc";

  // Rank only means something when the rows are ordered by a stat.
  const isStatSort = params.sort !== "firstName" && params.sort !== "lastName";

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
    return (
      <th
        key={sortKey}
        // Stat headers right-align their link. Marked explicitly rather than by
        // column position: the star column shifts every index by one, and only
        // for signed-in users.
        className={isStatColumn ? styles.statHeader : undefined}
        aria-sort={isActive ? (params.dir === "asc" ? "ascending" : "descending") : undefined}
        data-sort-active={isActive || undefined}
      >
        <Link
          href={buildPlayersHref({ ...params, page: 1, sort: sortKey, dir: nextDir({ sortKey }) })}
          className={styles.sortLink}
          data-active={isActive ? "true" : "false"}
          aria-describedby={tipId}
        >
          {label}
          {isActive && <span aria-hidden="true">{params.dir === "asc" ? "▲" : "▼"}</span>}
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

  // The star column has no visible header: the buttons name themselves, and a
  // visible "Watchlist" label would cost a column of width on every row.
  // Signed out there is no watchlist to act on, and 50 icon-only sign-in links
  // would be pure tab-order noise, so the column is omitted entirely.
  const starHeader = isSignedIn && (
    <th className={styles.starColumn}>
      <span className={styles.visuallyHidden}>Watchlist</span>
    </th>
  );

  const starCell = ({ playerId, fullName }: { playerId: number; fullName: string }) =>
    isSignedIn && (
      <td className={styles.starCell}>
        <StarButton playerId={playerId} fullName={fullName} isSignedIn />
      </td>
    );

  const rankCell = ({ index }: { index: number }) => (
    <td className={`${styles.numeric} ${styles.rank}`}>{(page - 1) * params.size + index + 1}</td>
  );

  if (props.variant === "advanced") {
    return (
      <div className={styles.tableScroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              {starHeader}
              {isStatSort && (
                <th className={styles.numeric} title="Rank in the current sort">
                  #
                </th>
              )}
              {renderSortableHeader({ label: "First name", sortKey: "firstName" })}
              {renderSortableHeader({ label: "Last name", sortKey: "lastName" })}
              <th>Team</th>
              <th>Position</th>
              {ADVANCED_STAT_META.map((meta) =>
                renderSortableHeader({
                  label: meta.label,
                  sortKey: meta.key,
                  meta,
                  isStatColumn: true,
                }),
              )}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, index) => (
              <tr key={row.id}>
                {starCell({ playerId: row.id, fullName: row.fullName })}
                {isStatSort && rankCell({ index })}
                <td data-sort-active={params.sort === "firstName" || undefined}>
                  <span className={styles.nameCell}>
                    <PlayerAvatar
                      fullName={row.fullName}
                      nbaPersonId={row.nbaPersonId}
                      size="sm"
                      teamAbbr={row.teamAbbr}
                    />
                    <Link href={`/players/${row.id}`}>{row.firstName}</Link>
                  </span>
                </td>
                <td data-sort-active={params.sort === "lastName" || undefined}>
                  <Link href={`/players/${row.id}`}>{row.lastName}</Link>
                </td>
                <td>{row.teamAbbr === null ? "—" : <TeamChip team={row.teamAbbr} size="sm" />}</td>
                <td>{row.position ?? "—"}</td>
                {ADVANCED_STAT_META.map((meta) => (
                  <td
                    key={meta.key}
                    className={styles.numeric}
                    data-sort-active={params.sort === meta.key || undefined}
                  >
                    {formatAdvancedMetric({ metricKey: meta.key, value: row.stats[meta.key] })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={styles.tableScroller}>
      <table className={styles.table}>
        <thead>
          <tr>
            {starHeader}
            {isStatSort && (
              <th className={styles.numeric} title="Rank in the current sort">
                #
              </th>
            )}
            {renderSortableHeader({ label: "First name", sortKey: "firstName" })}
            {renderSortableHeader({ label: "Last name", sortKey: "lastName" })}
            <th>Team</th>
            <th>Position</th>
            {STAT_COLUMNS.map((column) =>
              renderSortableHeader({
                label: column.label,
                sortKey: column.sortKey,
                isStatColumn: true,
              }),
            )}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => {
            const stats = row.stats ?? row.seasonStats?.[0];
            const formatCountingStat = (value: number) =>
              params.mode === "total"
                ? String(value)
                : formatPerGame(value, stats?.gamesPlayed ?? 0);
            return (
              <tr key={row.id}>
                {starCell({ playerId: row.id, fullName: row.fullName })}
                {isStatSort && rankCell({ index })}
                <td data-sort-active={params.sort === "firstName" || undefined}>
                  <span className={styles.nameCell}>
                    <PlayerAvatar
                      fullName={row.fullName}
                      nbaPersonId={row.nbaPersonId}
                      size="sm"
                      teamAbbr={row.teamAbbr}
                    />
                    <Link href={`/players/${row.id}`}>{row.firstName}</Link>
                  </span>
                </td>
                <td data-sort-active={params.sort === "lastName" || undefined}>
                  <Link href={`/players/${row.id}`}>{row.lastName}</Link>
                </td>
                <td>{row.teamAbbr === null ? "—" : <TeamChip team={row.teamAbbr} size="sm" />}</td>
                <td>{row.position ?? "—"}</td>
                {STAT_COLUMNS.map((column) => (
                  <td
                    key={column.sortKey}
                    className={styles.numeric}
                    data-sort-active={params.sort === column.sortKey || undefined}
                  >
                    {stats ? column.value({ stats, formatCountingStat }) : "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
