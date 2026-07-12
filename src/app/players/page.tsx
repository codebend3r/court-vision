import Link from "next/link";

import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayersPager } from "@/components/PlayersPager/PlayersPager";
import { PlayersSearchControls } from "@/components/PlayersSearchControls/PlayersSearchControls";
import { TeamChip } from "@/components/TeamChip/TeamChip";
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
      <th aria-sort={isActive ? (params.dir === "asc" ? "ascending" : "descending") : undefined}>
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
                  {renderSortableHeader({ label: "GP", sortKey: "gamesPlayed" })}
                  {renderSortableHeader({ label: "PTS", sortKey: "pts" })}
                  {renderSortableHeader({ label: "REB", sortKey: "reb" })}
                  {renderSortableHeader({ label: "AST", sortKey: "ast" })}
                  {renderSortableHeader({ label: "STL", sortKey: "stl" })}
                  {renderSortableHeader({ label: "BLK", sortKey: "blk" })}
                  {renderSortableHeader({ label: "FGM", sortKey: "fgm" })}
                  {renderSortableHeader({ label: "FGA", sortKey: "fga" })}
                  {renderSortableHeader({ label: "3PM", sortKey: "fg3m" })}
                  {renderSortableHeader({ label: "3PA", sortKey: "fg3a" })}
                  {renderSortableHeader({ label: "FG%", sortKey: "fgPct" })}
                  {renderSortableHeader({ label: "FT%", sortKey: "ftPct" })}
                  {renderSortableHeader({ label: "TOV", sortKey: "tov" })}
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
                      <td>
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
                      <td>
                        <Link href={`/players/${row.id}`}>{row.lastName}</Link>
                      </td>
                      <td>
                        {row.teamAbbr === null ? "—" : <TeamChip team={row.teamAbbr} size="sm" />}
                      </td>
                      <td>{row.position ?? "—"}</td>
                      <td className={styles.numeric}>{stats ? String(stats.gamesPlayed) : "—"}</td>
                      <td className={styles.numeric}>
                        {stats ? formatCountingStat(stats.pts) : "—"}
                      </td>
                      <td className={styles.numeric}>
                        {stats ? formatCountingStat(stats.reb) : "—"}
                      </td>
                      <td className={styles.numeric}>
                        {stats ? formatCountingStat(stats.ast) : "—"}
                      </td>
                      <td className={styles.numeric}>
                        {stats ? formatCountingStat(stats.stl) : "—"}
                      </td>
                      <td className={styles.numeric}>
                        {stats ? formatCountingStat(stats.blk) : "—"}
                      </td>
                      <td className={styles.numeric}>
                        {stats ? formatCountingStat(stats.fgm) : "—"}
                      </td>
                      <td className={styles.numeric}>
                        {stats ? formatCountingStat(stats.fga) : "—"}
                      </td>
                      <td className={styles.numeric}>
                        {stats ? formatCountingStat(stats.fg3m) : "—"}
                      </td>
                      <td className={styles.numeric}>
                        {stats ? formatCountingStat(stats.fg3a) : "—"}
                      </td>
                      <td className={styles.numeric}>
                        {stats ? formatPercentage(stats.fgm, stats.fga) : "—"}
                      </td>
                      <td className={styles.numeric}>
                        {stats ? formatPercentage(stats.ftm, stats.fta) : "—"}
                      </td>
                      <td className={styles.numeric}>
                        {stats ? formatCountingStat(stats.tov) : "—"}
                      </td>
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
