import Link from "next/link";
import styles from "@/app/players/page.module.scss";
import { AdvancedStatsLegend } from "@/components/AdvancedStatsLegend/AdvancedStatsLegend";
import { FantasyValueView } from "@/components/FantasyValueView/FantasyValueView";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayersPager } from "@/components/PlayersPager/PlayersPager";
import { PlayersSearchControls } from "@/components/PlayersSearchControls/PlayersSearchControls";
import { PlayersTabs } from "@/components/PlayersTabs/PlayersTabs";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { ADVANCED_STAT_META, type AdvancedStatMeta } from "@/lib/players/advancedStatMeta";
import type { PlayerStats } from "@/lib/players/search";
import { searchPlayers, searchPlayersAdvanced } from "@/lib/players/searchCached";
import {
  type AdvancedMetricKey,
  type AdvancedSortKey,
  buildPlayersHref,
  type PlayerSortKey,
  parsePlayersSearchParams,
  type SortDirection,
} from "@/lib/players/searchParams";
import { getFantasyPool } from "@/lib/valuation/loader";
import { loadFantasySearchParams } from "@/lib/valuation/searchParams";

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

const renderSummary = ({
  total,
  q,
  rangeStart,
  rangeEnd,
}: {
  total: number;
  q: string;
  rangeStart: number;
  rangeEnd: number;
}): string =>
  total === 0
    ? q === ""
      ? "No players yet — the season data hasn't been synced."
      : `No players match "${q}".`
    : `Showing ${rangeStart}–${rangeEnd} of ${total}`;

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
    tab: firstValue(raw.tab),
  });

  const tabsNav = (
    <PlayersTabs active={params.tab} q={params.q} size={params.size} range={params.range} />
  );

  // Remounting the results on any reorder/repage (tab, sort, range, mode, page)
  // replays the enter animation, so a section swap reads as a deliberate
  // transition. `q` is intentionally excluded: typing already gets the pending
  // dim, and keying on it would refade (and interrupt) on every keystroke.
  const resultsKey = `${params.tab}:${params.sort}:${params.dir}:${params.range}:${params.mode}:${params.page}`;

  if (params.tab === "fantasy") {
    // Fantasy owns its URL state via nuqs; only `range` selects server data.
    // Everything else (weights, exclusions, sort, paging) computes client-side
    // in FantasyValueView from this one cached pool payload.
    const { range } = await loadFantasySearchParams(raw);
    const lines = await getFantasyPool({ range });
    return (
      <main className={styles.page}>
        <h1>Players</h1>
        {tabsNav}
        <FantasyValueView lines={lines} />
      </main>
    );
  }

  const nextDir = ({ sortKey }: { sortKey: PlayerSortKey | AdvancedSortKey }): SortDirection =>
    params.sort === sortKey ? (params.dir === "desc" ? "asc" : "desc") : "desc";

  // Rank only means something when the rows are ordered by a stat.
  const isStatSort = params.sort !== "firstName" && params.sort !== "lastName";

  const renderSortableHeader = ({
    label,
    sortKey,
    meta,
  }: {
    label: string;
    sortKey: PlayerSortKey | AdvancedSortKey;
    meta?: AdvancedStatMeta;
  }) => {
    const isActive = params.sort === sortKey;
    const tipId = meta && `stat-tip-${meta.key}`;
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

  if (params.tab === "advanced") {
    const { rows, total, page } = await searchPlayersAdvanced(params);
    const totalPages = Math.max(1, Math.ceil(total / params.size));
    const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
    const rangeEnd = Math.min(total, page * params.size);

    return (
      <main className={styles.page}>
        <h1>Players</h1>
        {tabsNav}
        <PlayersSearchControls
          q={params.q}
          size={params.size}
          sort={params.sort}
          dir={params.dir}
          range={params.range}
          mode={params.mode}
          minimums={params.minimums}
          tab={params.tab}
        />
        <section className={styles.results} key={resultsKey}>
          <p className={styles.summary}>
            {renderSummary({ total, q: params.q, rangeStart, rangeEnd })}
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
                tab={params.tab}
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
                      {ADVANCED_STAT_META.map((meta) =>
                        renderSortableHeader({ label: meta.label, sortKey: meta.key, meta }),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
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
                        {ADVANCED_STAT_META.map((meta) => (
                          <td
                            key={meta.key}
                            className={styles.numeric}
                            data-sort-active={params.sort === meta.key || undefined}
                          >
                            {formatAdvancedMetric({
                              metricKey: meta.key,
                              value: row.stats[meta.key],
                            })}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AdvancedStatsLegend />
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
                tab={params.tab}
              />
            </>
          )}
        </section>
      </main>
    );
  }

  const { rows, total, page } = await searchPlayers(params);
  const totalPages = Math.max(1, Math.ceil(total / params.size));
  const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
  const rangeEnd = Math.min(total, page * params.size);

  return (
    <main className={styles.page}>
      <h1>Players</h1>
      {tabsNav}
      <PlayersSearchControls
        q={params.q}
        size={params.size}
        sort={params.sort}
        dir={params.dir}
        range={params.range}
        mode={params.mode}
        minimums={params.minimums}
        tab={params.tab}
      />
      <section className={styles.results} key={resultsKey}>
        <p className={styles.summary}>
          {renderSummary({ total, q: params.q, rangeStart, rangeEnd })}
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
              tab={params.tab}
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
              tab={params.tab}
            />
          </>
        )}
      </section>
    </main>
  );
}
