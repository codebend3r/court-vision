import type { ReactNode } from "react";

import { AdvancedStatsLegend } from "@/components/AdvancedStatsLegend/AdvancedStatsLegend";
import { FantasyValueView } from "@/components/FantasyValueView/FantasyValueView";
import { PageHeader } from "@/components/PageHeader/PageHeader";
import { PlayersPager } from "@/components/PlayersPager/PlayersPager";
import { PlayersSearchControls } from "@/components/PlayersSearchControls/PlayersSearchControls";
import { PlayersTable } from "@/components/PlayersTable/PlayersTable";
import { PlayersTabs } from "@/components/PlayersTabs/PlayersTabs";
import { StarredPlayersView } from "@/components/StarredPlayersView/StarredPlayersView";
import { getProfile, getUser } from "@/lib/auth/session";
import { buildLeagueSeed } from "@/lib/leagues/fantasyDefaults";
import { getActiveLeague } from "@/lib/leagues/queries";
import { searchPlayers, searchPlayersAdvanced } from "@/lib/players/searchCached";
import { parsePlayersSearchParams, type PlayersSearchParams } from "@/lib/players/searchParams";
import { getFantasyPool } from "@/lib/valuation/loader";
import { ENABLED_METHODS } from "@/lib/valuation/registry";
import { loadFantasySearchParams } from "@/lib/valuation/searchParams";

import { PLAYERS_PAGE_HEADER } from "@/app/players/header";

import styles from "@/app/players/page.module.scss";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const totalPagesOf = ({ total, size }: { total: number; size: number }): number =>
  Math.max(1, Math.ceil(total / size));

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

// The frame all four tabs share. Kept in this file rather than src/components
// because it renders page.module.scss: a shared component would have to import
// another segment's stylesheet to do the same job.
function PlayersScreen({ params, children }: { params: PlayersSearchParams; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <PageHeader {...PLAYERS_PAGE_HEADER} />
      <PlayersTabs active={params.tab} q={params.q} size={params.size} range={params.range} />
      {children}
    </main>
  );
}

// The table tabs (regular and advanced) share everything around the table:
// the same controls, the same counter, the same empty state. Only the query,
// the table variant, and the advanced legend differ, and those stay in the
// callers because `variant` and `rows` are a discriminated pair on
// PlayersTable; collapsing them here would need a cast to reunite.
function PlayersResults({
  params,
  total,
  page,
  children,
}: {
  params: PlayersSearchParams;
  total: number;
  page: number;
  children: ReactNode;
}) {
  const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
  const rangeEnd = Math.min(total, page * params.size);
  // Remounting the results on any reorder/repage (tab, sort, range, mode, page)
  // replays the enter animation, so a section swap reads as a deliberate
  // transition. `q` is intentionally excluded: typing already gets the pending
  // dim, and keying on it would refade (and interrupt) on every keystroke.
  const resultsKey = `${params.tab}:${params.sort}:${params.dir}:${params.range}:${params.mode}:${params.page}`;
  return (
    <>
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
        {total > 0 && children}
      </section>
    </>
  );
}

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

  // Every tab renders star controls, and a star is only actionable with an
  // account; signed out, StarButton links to sign-in instead.
  const isSignedIn = !!(await getUser());

  if (params.tab === "starred") {
    return (
      <PlayersScreen params={params}>
        <StarredPlayersView params={params} showCounter={false} />
      </PlayersScreen>
    );
  }

  if (params.tab === "fantasy") {
    // Fantasy owns its URL state via nuqs; only `range` selects server data.
    // Everything else (weights, exclusions, sort, paging) computes client-side
    // in FantasyValueView from this one cached pool payload.
    const { range } = await loadFantasySearchParams(raw);
    const [lines, league, profile] = await Promise.all([
      getFantasyPool({ range }),
      getActiveLeague(),
      getProfile(),
    ]);
    const presentKeys = new Set(Object.keys(raw));
    const formula =
      ENABLED_METHODS.find((method) => method.key === profile?.preferredFormula)?.key ?? null;
    const leagueSeed = buildLeagueSeed({ league, preferredFormula: formula, presentKeys });
    return (
      <PlayersScreen params={params}>
        <FantasyValueView lines={lines} isSignedIn={isSignedIn} leagueSeed={leagueSeed} />
      </PlayersScreen>
    );
  }

  if (params.tab === "advanced") {
    const { rows, total, page } = await searchPlayersAdvanced(params);
    return (
      <PlayersScreen params={params}>
        <PlayersResults params={params} total={total} page={page}>
          <PlayersTable
            variant="advanced"
            rows={rows}
            params={params}
            page={page}
            isSignedIn={isSignedIn}
            footer={
              <PlayersPager
                {...params}
                page={page}
                totalPages={totalPagesOf({ total, size: params.size })}
              />
            }
          />
          <AdvancedStatsLegend />
        </PlayersResults>
      </PlayersScreen>
    );
  }

  const { rows, total, page } = await searchPlayers(params);
  return (
    <PlayersScreen params={params}>
      <PlayersResults params={params} total={total} page={page}>
        <PlayersTable
          variant="regular"
          rows={rows}
          params={params}
          page={page}
          isSignedIn={isSignedIn}
          footer={
            <PlayersPager
              {...params}
              page={page}
              totalPages={totalPagesOf({ total, size: params.size })}
            />
          }
        />
      </PlayersResults>
    </PlayersScreen>
  );
}
