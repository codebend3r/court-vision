import { redirect } from "next/navigation";
import { type ReactNode } from "react";

import { AdvancedStatsLegend } from "@/components/AdvancedStatsLegend/AdvancedStatsLegend";
import { FantasyTeamLogo } from "@/components/FantasyTeamLogo/FantasyTeamLogo";
import { FantasyValueView } from "@/components/FantasyValueView/FantasyValueView";
import { MyTeamPicker } from "@/components/MyTeamPicker/MyTeamPicker";
import { ADVANCED_COLUMNS, regularColumns } from "@/components/PlayersTable/PlayersTable";
import { RosterControls } from "@/components/RosterControls/RosterControls";
import { RosterStatCharts } from "@/components/RosterStatCharts/RosterStatCharts";
import { RosterStatTable } from "@/components/RosterStatTable/RosterStatTable";
import { getProfile } from "@/lib/auth/session";
import { featuredTeam } from "@/lib/fantasyTeams/featured";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";
import { buildLeagueSeed } from "@/lib/leagues/fantasyDefaults";
import { getActiveLeague } from "@/lib/leagues/queries";
import { getLeagueTeams } from "@/lib/leagues/teamQueries";
import { type PlayerIdentity } from "@/lib/players/identity";
import { getAdvancedPool, getRegularPool } from "@/lib/players/searchCached";
import { type RawSearchParams } from "@/lib/players/searchParams";
import { type StatColumn } from "@/lib/players/statColumn";
import { buildRosterCharts } from "@/lib/roster/charts";
import { type StatSpec } from "@/lib/roster/compare";
import { buildRosterTable } from "@/lib/roster/table";
import { matchRosterRows, rosterMembers, unmatchedNames } from "@/lib/roster/members";
import {
  buildRosterHref,
  parseRosterParams,
  ROSTER_TAB_LABELS,
  ROSTER_TABS,
  type RosterParams,
} from "@/lib/roster/searchParams";
import { advancedSpecs, regularSpecs } from "@/lib/roster/statSpecs";
import { getFantasyPool } from "@/lib/valuation/loader";
import { FANTASY_METHODS } from "@vision/sport-basketball/engine";
import { PageAction, PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { StatViewTabs } from "@vision/ui/components/StatViewTabs/StatViewTabs";

import { ROSTER_PAGE_HEADER } from "@/app/roster/header";

import styles from "@/app/roster/page.module.scss";

export const dynamic = "force-dynamic";

const IMPORT_PATH = "/leagues/import";

function RosterScreen({ children, params }: { children: ReactNode; params?: RosterParams }) {
  const isOtherTeam = !!params?.team;
  return (
    <main className={styles.page}>
      <PageHeader
        {...ROSTER_PAGE_HEADER}
        actions={
          <PageAction href="/my-teams">{isOtherTeam ? "All teams" : "Fantasy League"}</PageAction>
        }
      />
      {params !== undefined && (
        <StatViewTabs
          label="Roster stat views"
          entries={ROSTER_TABS.map((tab) => ({
            key: tab,
            label: ROSTER_TAB_LABELS[tab],
            isActive: tab === params.tab,
            href: buildRosterHref({ ...params, tab }),
          }))}
        />
      )}
      {children}
    </main>
  );
}

// Every state short of a roster: the page's own header, then why there is none
// yet and what to do about it.
function RosterGate({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <RosterScreen>
      <section className={styles.gate} aria-label="Roster status">
        <p className={styles.message}>{message}</p>
        {children}
      </section>
    </RosterScreen>
  );
}

const playerNames = ({ team }: { team: FantasyTeam }): Map<number, string> =>
  new Map(
    team.slots.flatMap((slot) =>
      slot.player === null ? [] : [[slot.player.playerId, slot.player.fullName]],
    ),
  );

// What the stats can't show: rostered players with no games in this window, and
// Yahoo names that matched no Court Vision player.
function RosterNotes({
  team,
  missing,
  rangeLabel,
}: {
  team: FantasyTeam;
  missing: readonly number[];
  rangeLabel: string;
}) {
  const names = playerNames({ team });
  const noGames = missing.flatMap((id) => names.get(id) ?? []);
  const unmatched = unmatchedNames({ team });
  if (!noGames.length && !unmatched.length) return null;
  return (
    <p className={styles.notes}>
      {!!noGames.length && (
        <span>
          No games in this window ({rangeLabel}): {noGames.join(", ")}.
        </span>
      )}
      {!!unmatched.length && (
        <span>Not matched to a Court Vision player, so no stats: {unmatched.join(", ")}.</span>
      )}
    </p>
  );
}

// The regular and advanced tabs differ only in their pool, columns, stat specs
// and legend; the table over the roster, the charts under it, and the notes
// are the same.
function RosterStats<Row extends PlayerIdentity>({
  label,
  team,
  params,
  pool,
  columns,
  specs,
  gamesOf,
  children,
}: {
  label: string;
  team: FantasyTeam;
  params: RosterParams;
  pool: readonly Row[];
  columns: readonly StatColumn<Row>[];
  specs: readonly StatSpec<Row>[];
  gamesOf: (row: Row) => number;
  children?: ReactNode;
}) {
  const { matched, missing } = matchRosterRows({ members: rosterMembers({ team }), pool });
  const charts = buildRosterCharts({ rows: matched.map(({ row }) => row), pool, specs, gamesOf });
  return (
    <section className={styles.results}>
      <RosterControls params={params} showMode={params.tab === "regular"} />
      {matched.length === 0 ? (
        <p className={styles.message}>None of your players has a game in this window yet.</p>
      ) : (
        <>
          <RosterStatTable label={label} {...buildRosterTable({ rows: matched, columns })} />
          <RosterStatCharts label={`${label} charts`} charts={charts} />
          {children}
        </>
      )}
      <RosterNotes team={team} missing={missing} rangeLabel={params.range} />
    </section>
  );
}

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const [raw, profile, league] = await Promise.all([searchParams, getProfile(), getActiveLeague()]);
  if (profile === null) redirect("/login?next=/roster");

  if (league === null) {
    return (
      <RosterGate message="No league yet. Import your Yahoo league to see your roster's stats.">
        <PageAction href={IMPORT_PATH}>Import from Yahoo</PageAction>
      </RosterGate>
    );
  }

  const teams = await getLeagueTeams({ leagueId: league.id });

  if (league.isImported && league.myTeamId === null) {
    return (
      <RosterGate message="Which team is yours?">
        <MyTeamPicker leagueId={league.id} teams={teams} />
      </RosterGate>
    );
  }

  // `?team=<slug>` reads a league-mate's roster through the same view.
  const params = parseRosterParams({ raw });
  const requested = params.team === null ? null : teams.find(({ slug }) => slug === params.team);
  const team = requested ?? featuredTeam({ teams });
  if (team === null) {
    return (
      <RosterGate message="No team to show yet. Build one in Fantasy League, and its stats land here.">
        <PageAction href="/my-teams/create">New team</PageAction>
      </RosterGate>
    );
  }

  const members = rosterMembers({ team });
  const filled = members.length;

  const teamHeading = (
    <section className={styles.team} aria-label="Team">
      <FantasyTeamLogo name={team.name} logoUrl={team.logoUrl} size="md" />
      <div className={styles.teamText}>
        <h2 className={styles.teamName}>{team.name}</h2>
        <p className={styles.teamMeta}>
          {league.name} · {filled === 1 ? "1 player" : `${filled} players`}
        </p>
      </div>
    </section>
  );

  if (params.tab === "fantasy") {
    const lines = await getFantasyPool({ range: params.range });
    const presentKeys = new Set(Object.keys(raw));
    const formula =
      FANTASY_METHODS.find((method) => method.key === profile.preferredFormula)?.key ?? null;
    const leagueSeed = buildLeagueSeed({ league, preferredFormula: formula, presentKeys });
    return (
      <RosterScreen params={params}>
        {teamHeading}
        <FantasyValueView
          lines={lines}
          isSignedIn
          leagueSeed={leagueSeed}
          rosterPlayerIds={members.map(({ playerId }) => playerId)}
        />
      </RosterScreen>
    );
  }

  if (params.tab === "advanced") {
    const pool = await getAdvancedPool({ range: params.range });
    return (
      <RosterScreen params={params}>
        {teamHeading}
        <RosterStats
          label="Advanced stats"
          team={team}
          params={params}
          pool={pool}
          columns={ADVANCED_COLUMNS}
          specs={advancedSpecs()}
          gamesOf={({ stats }) => stats.gamesWithData}
        >
          <AdvancedStatsLegend />
        </RosterStats>
      </RosterScreen>
    );
  }

  const pool = await getRegularPool({ range: params.range });
  return (
    <RosterScreen params={params}>
      {teamHeading}
      <RosterStats
        label="Regular stats"
        team={team}
        params={params}
        pool={pool}
        columns={regularColumns({ mode: params.mode })}
        specs={regularSpecs({ mode: params.mode })}
        gamesOf={({ stats }) => stats.gamesPlayed}
      />
    </RosterScreen>
  );
}
