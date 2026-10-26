import { redirect } from "next/navigation";
import { type ReactNode } from "react";

import { LeagueTotalsTable } from "@/components/MatchupView/LeagueTotalsTable";
import { MatchupPanel } from "@/components/MatchupView/MatchupPanel";
import { StandingsSummary } from "@/components/MatchupView/StandingsSummary";
import { MyTeamPicker } from "@/components/MyTeamPicker/MyTeamPicker";
import { SyncYahooButton } from "@/components/SyncYahooButton/SyncYahooButton";
import { getProfile } from "@/lib/auth/session";
import { getActiveLeagueRecord, toLeagueSummary } from "@/lib/leagues/queries";
import { getLeagueTeams } from "@/lib/leagues/teamQueries";
import { getLeagueWeek } from "@/lib/matchups/loader";
import {
  loadMatchupSearchParams,
  MATCHUP_VIEW_LABELS,
  MATCHUP_VIEWS,
  matchupHref,
} from "@/lib/matchups/searchParams";
import { buildStandings } from "@/lib/matchups/standings";
import { type LeagueWeek } from "@/lib/matchups/types";
import { type RawSearchParams } from "@/lib/players/searchParams";
import { PageAction, PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { StatViewTabs } from "@vision/ui/components/StatViewTabs/StatViewTabs";

import { MATCHUP_PAGE_HEADER } from "@/app/matchup/header";

import styles from "@/app/matchup/matchup.module.scss";

export const dynamic = "force-dynamic";

const IMPORT_PATH = "/leagues/import";

// Every state short of the week: the page's own header, then why there is no
// matchup yet and what to do about it.
type MatchupGateProps = { message: string; children?: ReactNode };

function MatchupGate({ message, children }: MatchupGateProps) {
  return (
    <main className={styles.page}>
      <PageHeader {...MATCHUP_PAGE_HEADER} />
      <section className={styles.gate} aria-label="Matchup status">
        <p className={styles.message}>{message}</p>
        {children}
      </section>
    </main>
  );
}

// "Week 3, Oct 20 to Oct 26".
type WeekEyebrowProps = { week: LeagueWeek };

const weekEyebrow = ({ week }: WeekEyebrowProps): string => {
  const format = (value: string | null): string | null => {
    const date = value === null ? null : new Date(`${value}T12:00:00Z`);
    return date === null || Number.isNaN(date.getTime())
      ? null
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  };
  const start = format(week.weekStart);
  const end = format(week.weekEnd);
  return start !== null && end !== null
    ? `Week ${week.week}, ${start} to ${end}`
    : `Week ${week.week}`;
};

type MatchupPageProps = {
  searchParams: Promise<RawSearchParams>;
};

export default async function MatchupPage({ searchParams }: MatchupPageProps) {
  const [profile, record] = await Promise.all([getProfile(), getActiveLeagueRecord()]);
  if (profile === null) redirect("/login?next=/matchup");

  if (record === null) {
    return (
      <MatchupGate message="No league yet. Import your Yahoo league to see this week's matchup.">
        <PageAction href={IMPORT_PATH}>Import from Yahoo</PageAction>
      </MatchupGate>
    );
  }
  const league = toLeagueSummary({ league: record });

  if (!league.isImported) {
    return (
      <MatchupGate message="Matchups need a league imported from Yahoo, so they know the schedule and every team's totals.">
        <PageAction href={IMPORT_PATH}>Import from Yahoo</PageAction>
      </MatchupGate>
    );
  }

  if (league.scoringType !== "h2h_categories") {
    return (
      <MatchupGate message="Matchups are for head-to-head categories leagues. This league scores another way." />
    );
  }

  if (league.myTeamId === null) {
    const teams = await getLeagueTeams({ leagueId: league.id });
    return (
      <MatchupGate message="Which team is yours?">
        <MyTeamPicker leagueId={league.id} teams={teams} />
      </MatchupGate>
    );
  }

  const [{ view }, week] = await Promise.all([
    searchParams.then((raw) => loadMatchupSearchParams(raw)),
    getLeagueWeek({ league: record }),
  ]);

  const syncButton = (
    <SyncYahooButton
      leagueId={league.id}
      syncedAt={league.syncedAt}
      syncError={league.syncError}
      syncVia={league.syncVia}
      externalUrl={league.externalUrl}
      autoSyncWhenStale
    />
  );

  if (week === null) {
    return (
      <main className={styles.page}>
        <PageHeader
          {...MATCHUP_PAGE_HEADER}
          eyebrow={`${league.name} · Yahoo`}
          actions={syncButton}
        />
        <section className={styles.gate} aria-label="Matchup status">
          <p className={styles.message}>
            No matchup data yet. Sync your league to load the week&apos;s scoreboard from Yahoo.
          </p>
        </section>
      </main>
    );
  }

  const mine = week.teams.find((team) => team.isMine);
  const pairing = week.pairings.find(
    ({ teamAId, teamBId }) => teamAId === league.myTeamId || teamBId === league.myTeamId,
  );
  const opponentId =
    pairing === undefined
      ? undefined
      : pairing.teamAId === league.myTeamId
        ? pairing.teamBId
        : pairing.teamAId;
  const opponent = week.teams.find((team) => team.teamId === opponentId);

  return (
    <main className={styles.page}>
      <PageHeader
        {...MATCHUP_PAGE_HEADER}
        eyebrow={`${league.name} · ${weekEyebrow({ week })}`}
        actions={
          <>
            {syncButton}
            {!!league.externalUrl && (
              // The hidden note, read as the description, says the link
              // leaves for a new tab.
              <a
                href={league.externalUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.external}
              >
                Open in Yahoo
                <span className={styles.srOnly}> (opens in new tab)</span>
              </a>
            )}
          </>
        }
      />
      <p className={styles.credit}>
        Scoreboard updated:{" "}
        {week.syncedAt === null ? (
          "unknown — sync to refresh"
        ) : (
          <time dateTime={week.syncedAt}>
            {new Date(week.syncedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC
          </time>
        )}
      </p>
      <StatViewTabs
        label="Matchup views"
        entries={MATCHUP_VIEWS.map((entry) => ({
          key: entry,
          label: MATCHUP_VIEW_LABELS[entry],
          isActive: entry === view,
          href: matchupHref({ view: entry }),
        }))}
      />
      {view === "matchup" &&
        (mine !== undefined && opponent !== undefined ? (
          <MatchupPanel week={week} mine={mine} opponent={opponent} />
        ) : (
          <section className={styles.gate} aria-label="Matchup status">
            <p className={styles.message}>
              Your team has no opponent this week. See the league totals instead.
            </p>
          </section>
        ))}
      {view === "league" && (
        <>
          {mine !== undefined && (
            <StandingsSummary
              teamName={mine.name}
              standings={
                buildStandings({
                  categories: week.categories,
                  teams: week.teams,
                }).get(mine.teamId) ?? []
              }
            />
          )}
          <LeagueTotalsTable week={week} opponentId={opponentId} />
        </>
      )}
      <p className={styles.credit}>League data from Yahoo Fantasy</p>
    </main>
  );
}
