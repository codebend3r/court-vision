import Link from "next/link";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayersPager } from "@/components/PlayersPager/PlayersPager";
import { PlayersSearchControls } from "@/components/PlayersSearchControls/PlayersSearchControls";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { searchPlayers, type PlayerStats } from "@/lib/players/search";
import {
  buildPlayersHref,
  parsePlayersSearchParams,
  type PlayerSortKey,
  type SortDirection,
} from "@/lib/players/searchParams";

import styles from "@/app/players/page.module.scss";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

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

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const params = parsePlayersSearchParams({
    q: firstValue(raw.q),
    page: firstValue(raw.page),
    size: firstValue(raw.size),
    sort: firstValue(raw.sort),
    dir: firstValue(raw.dir),
    range: firstValue(raw.range),
    mode: firstValue(raw.mode),
    minimums: firstValue(raw.minimums),
  });
  const { rows, total, page } = await searchPlayers(params);
  const totalPages = Math.max(1, Math.ceil(total / params.size));
  const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
  const rangeEnd = Math.min(total, page * params.size);

  const nextDir = ({ sortKey }: { sortKey: PlayerSortKey }): SortDirection =>
    params.sort === sortKey ? (params.dir === "desc" ? "asc" : "desc") : "desc";

  // Rank only means something when the rows are ordered by a stat.
  const isStatSort = params.sort !== "firstName" && params.sort !== "lastName";

  const renderSortableHeader = ({ label, sortKey }: { label: string; sortKey: PlayerSortKey }) => {
    const isActive = params.sort === sortKey;
    return (
      <th
        key={sortKey}
        aria-sort={isActive ? (params.dir === "asc" ? "ascending" : "descending") : undefined}
        data-sort-active={isActive || undefined}
      >
        <Link
          href={buildPlayersHref({ ...params, page: 1, sort: sortKey, dir: nextDir({ sortKey }) })}
          className={styles.sortLink}
          data-active={isActive ? "true" : "false"}
        >
          {label}
          {isActive && <span aria-hidden="true">{params.dir === "asc" ? "▲" : "▼"}</span>}
        </Link>
      </th>
    );
  };

  return (
    <main className={styles.page}>
      <h1>Players</h1>
      <PlayersSearchControls
        q={params.q}
        size={params.size}
        sort={params.sort}
        dir={params.dir}
        range={params.range}
        mode={params.mode}
        minimums={params.minimums}
      />
      <p className={styles.summary}>
        {total === 0
          ? params.q === ""
            ? "No players yet — the season data hasn't been synced."
            : `No players match "${params.q}".`
          : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
      </p>
      {total > 0 && (
        <>
          <PlayersPager
            q={params.q}
            page={page}
            size={params.size}
            totalPages={totalPages}
            sort={params.sort}
            dir={params.dir}
            range={params.range}
            mode={params.mode}
            minimums={params.minimums}
          />
          <div className={styles.tableScroller}>
            <table className={styles.table}>
              <thead>
                <tr>
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
                    renderSortableHeader({ label: column.label, sortKey: column.sortKey }),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const stats = row.stats ?? row.seasonStats?.[0];
                  const formatCountingStat = (value: number) =>
                    params.mode === "total"
                      ? String(value)
                      : formatPerGame(value, stats?.gamesPlayed ?? 0);
                  return (
                    <tr key={row.id}>
                      {isStatSort && (
                        <td className={`${styles.numeric} ${styles.rank}`}>
                          {(page - 1) * params.size + index + 1}
                        </td>
                      )}
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
                      <td>
                        {row.teamAbbr === null ? "—" : <TeamChip team={row.teamAbbr} size="sm" />}
                      </td>
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
          <PlayersPager
            q={params.q}
            page={page}
            size={params.size}
            totalPages={totalPages}
            sort={params.sort}
            dir={params.dir}
            range={params.range}
            mode={params.mode}
            minimums={params.minimums}
          />
        </>
      )}
    </main>
  );
}
