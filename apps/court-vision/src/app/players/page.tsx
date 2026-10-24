import type { ReactNode } from "react";

import { AdvancedStatsLegend } from "@/components/AdvancedStatsLegend/AdvancedStatsLegend";
import { FantasyValueView } from "@/components/FantasyValueView/FantasyValueView";
import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { PlayersPager } from "@/components/PlayersPager/PlayersPager";
import { PlayersSearchControls } from "@/components/PlayersSearchControls/PlayersSearchControls";
import {
  ADVANCED_COLUMNS,
  PlayersTable,
  regularColumns,
} from "@/components/PlayersTable/PlayersTable";
import { PlayersTabs } from "@/components/PlayersTabs/PlayersTabs";
import { StarredPlayersView } from "@/components/StarredPlayersView/StarredPlayersView";
import { getProfile, getUser } from "@/lib/auth/session";
import { buildLeagueSeed } from "@/lib/leagues/fantasyDefaults";
import { getActiveLeague } from "@/lib/leagues/queries";
import { getLeagueOwners } from "@/lib/leagues/teamQueries";
import { type PlayerIdentity } from "@/lib/players/identity";
import { type Page } from "@/lib/players/rank";
import { type StatColumn } from "@/lib/players/statColumn";
import { searchPlayers, searchPlayersAdvanced } from "@/lib/players/searchCached";
import {
  parsePlayersSearchParams,
  type PlayersSearchParams,
  type RawSearchParams,
} from "@/lib/players/searchParams";
import { getFantasyPool } from "@/lib/valuation/loader";
import { FANTASY_METHODS } from "@vision/sport-basketball/engine";

import { PLAYERS_PAGE_HEADER } from "@/app/players/header";

import styles from "@/app/players/page.module.scss";

export const dynamic = "force-dynamic";

// The players on some manager's roster, or null where the league's rosters are
// unknown. The owner quick filter narrows the pool by it.
const getTakenIds = async (): Promise<ReadonlySet<number> | null> => {
  const owners = await getLeagueOwners();
  return owners && new Set(owners.map((owner) => owner.playerId));
};

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
      <PlayersTabs
        active={params.tab}
        q={params.q}
        size={params.size}
        range={params.range}
        owner={params.owner}
      />
      {children}
    </main>
  );
}

// The table tabs (regular and advanced) share everything around the table:
// the same controls, the same counter, the same empty state, the same pager.
// Only the query, the columns, and the advanced legend (`children`) differ.
function PlayersResults<Row extends PlayerIdentity>({
  params,
  result: { rows, total, page },
  columns,
  isSignedIn,
  children,
}: {
  params: PlayersSearchParams;
  result: Page<Row>;
  columns: readonly StatColumn<Row>[];
  isSignedIn: boolean;
  children?: ReactNode;
}) {
  const rangeStart = total === 0 ? 0 : (page - 1) * params.size + 1;
  const rangeEnd = Math.min(total, page * params.size);
  // Remounting the results on any reorder/repage (tab, sort, range, mode, page)
  // replays the enter animation, so a section swap reads as a deliberate
  // transition. `q` is intentionally excluded: typing already gets the pending
  // dim, and keying on it would refade (and interrupt) on every keystroke.
  const resultsKey = `${params.tab}:${params.sort}:${params.dir}:${params.range}:${params.mode}:${params.page}`;
  return (
    <PlayersScreen params={params}>
      <PlayersSearchControls params={params} />
      <section className={styles.results} key={resultsKey}>
        <p className={styles.summary}>
          {renderSummary({ total, q: params.q, rangeStart, rangeEnd })}
        </p>
        {total > 0 && (
          <>
            <PlayersTable
              rows={rows}
              columns={columns}
              params={params}
              page={page}
              isSignedIn={isSignedIn}
              footer={
                <PlayersPager
                  params={params}
                  page={page}
                  totalPages={totalPagesOf({ total, size: params.size })}
                />
              }
            />
            {children}
          </>
        )}
      </section>
    </PlayersScreen>
  );
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const params = parsePlayersSearchParams({ raw });

  // Every tab renders star controls, and a star is only actionable with an
  // account; signed out, StarButton links to sign-in instead. Signed in, the
  // session check is a Supabase round trip, so each branch runs it alongside
  // its data read rather than before it.
  const signedIn = async (): Promise<boolean> => !!(await getUser());

  if (params.tab === "starred") {
    return (
      <PlayersScreen params={params}>
        <StarredPlayersView params={params} showCounter={false} />
      </PlayersScreen>
    );
  }

  if (params.tab === "fantasy") {
    // Fantasy owns the rest of its URL state client-side via nuqs; only
    // `range`, parsed by the same list parser, selects server data. Everything
    // else (weights, exclusions, sort, paging) computes in FantasyValueView
    // from this one cached pool payload.
    const [lines, league, profile, isSignedIn] = await Promise.all([
      getFantasyPool({ range: params.range }),
      getActiveLeague(),
      getProfile(),
      signedIn(),
    ]);
    const presentKeys = new Set(Object.keys(raw));
    const formula =
      FANTASY_METHODS.find((method) => method.key === profile?.preferredFormula)?.key ?? null;
    const leagueSeed = buildLeagueSeed({ league, preferredFormula: formula, presentKeys });
    return (
      <PlayersScreen params={params}>
        <FantasyValueView lines={lines} isSignedIn={isSignedIn} leagueSeed={leagueSeed} />
      </PlayersScreen>
    );
  }

  if (params.tab === "advanced") {
    const [takenIds, isSignedIn] = await Promise.all([getTakenIds(), signedIn()]);
    const result = await searchPlayersAdvanced({ ...params, takenIds });
    return (
      <PlayersResults
        params={params}
        result={result}
        columns={ADVANCED_COLUMNS}
        isSignedIn={isSignedIn}
      >
        <AdvancedStatsLegend />
      </PlayersResults>
    );
  }

  const [takenIds, isSignedIn] = await Promise.all([getTakenIds(), signedIn()]);
  const result = await searchPlayers({ ...params, takenIds });
  return (
    <PlayersResults
      params={params}
      result={result}
      columns={regularColumns({ mode: params.mode })}
      isSignedIn={isSignedIn}
    />
  );
}
