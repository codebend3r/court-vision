import Link from "next/link";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayersSearchControls } from "@/components/PlayersSearchControls/PlayersSearchControls";
import { searchPlayers } from "@/lib/players/search";
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
    retired: firstValue(raw.retired),
    sort: firstValue(raw.sort),
    dir: firstValue(raw.dir),
  });
  const { rows, total, page } = await searchPlayers(params);
  const totalPages = Math.max(1, Math.ceil(total / params.size));
  const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
  const rangeEnd = Math.min(total, page * params.size);

  const nextDir = ({ sortKey }: { sortKey: PlayerSortKey }): SortDirection =>
    params.sort === sortKey && params.dir === "asc" ? "desc" : "asc";

  const renderSortableHeader = ({ label, sortKey }: { label: string; sortKey: PlayerSortKey }) => {
    const isActive = params.sort === sortKey;
    return (
      <th aria-sort={isActive ? (params.dir === "asc" ? "ascending" : "descending") : undefined}>
        <Link
          href={buildPlayersHref({ ...params, page: 1, sort: sortKey, dir: nextDir({ sortKey }) })}
          className={styles.sortLink}
          data-active={isActive ? "true" : "false"}
        >
          {label}
          {isActive ? <span aria-hidden="true">{params.dir === "asc" ? "▲" : "▼"}</span> : null}
        </Link>
      </th>
    );
  };

  return (
    <main className={styles.page}>
      <h1>Players</h1>
      <PlayersSearchControls
        q={params.q}
        page={page}
        size={params.size}
        includeRetired={params.includeRetired}
        totalPages={totalPages}
        sort={params.sort}
        dir={params.dir}
      />
      <p className={styles.summary}>
        {total === 0
          ? params.q === ""
            ? "No players yet — the season data hasn't been synced."
            : `No players match "${params.q}".`
          : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
      </p>
      {total > 0 ? (
        <div className={styles.tableScroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                {renderSortableHeader({ label: "First name", sortKey: "firstName" })}
                {renderSortableHeader({ label: "Last name", sortKey: "lastName" })}
                <th>Team</th>
                <th>Position</th>
                <th className={styles.numeric}>PTS</th>
                <th className={styles.numeric}>REB</th>
                <th className={styles.numeric}>AST</th>
                <th className={styles.numeric}>STL</th>
                <th className={styles.numeric}>BLK</th>
                <th className={styles.numeric}>3PM</th>
                <th className={styles.numeric}>FG%</th>
                <th className={styles.numeric}>FT%</th>
                <th className={styles.numeric}>TOV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const stats = row.seasonStats?.[0];
                return (
                  <tr key={row.id}>
                    <td>
                      <span className={styles.nameCell}>
                        <PlayerAvatar
                          fullName={row.fullName}
                          nbaPersonId={row.nbaPersonId}
                          size="sm"
                        />
                        <Link href={`/players/${row.id}`}>{row.firstName}</Link>
                      </span>
                    </td>
                    <td>
                      <Link href={`/players/${row.id}`}>{row.lastName}</Link>
                    </td>
                    <td>{row.teamAbbr ?? "—"}</td>
                    <td>{row.position ?? "—"}</td>
                    <td className={styles.numeric}>
                      {stats ? formatPerGame(stats.pts, stats.gamesPlayed) : "—"}
                    </td>
                    <td className={styles.numeric}>
                      {stats ? formatPerGame(stats.reb, stats.gamesPlayed) : "—"}
                    </td>
                    <td className={styles.numeric}>
                      {stats ? formatPerGame(stats.ast, stats.gamesPlayed) : "—"}
                    </td>
                    <td className={styles.numeric}>
                      {stats ? formatPerGame(stats.stl, stats.gamesPlayed) : "—"}
                    </td>
                    <td className={styles.numeric}>
                      {stats ? formatPerGame(stats.blk, stats.gamesPlayed) : "—"}
                    </td>
                    <td className={styles.numeric}>
                      {stats ? formatPerGame(stats.fg3m, stats.gamesPlayed) : "—"}
                    </td>
                    <td className={styles.numeric}>
                      {stats ? formatPercentage(stats.fgm, stats.fga) : "—"}
                    </td>
                    <td className={styles.numeric}>
                      {stats ? formatPercentage(stats.ftm, stats.fta) : "—"}
                    </td>
                    <td className={styles.numeric}>
                      {stats ? formatPerGame(stats.tov, stats.gamesPlayed) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
