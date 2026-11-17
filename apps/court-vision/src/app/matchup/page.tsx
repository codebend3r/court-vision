import { redirect } from "next/navigation";
import { type ReactNode } from "react";

import { SeasonPanel } from "@/components/MatchupView/SeasonPanel";
import { LeagueTotalsTable } from "@/components/MatchupView/LeagueTotalsTable";
import { MatchupPanel } from "@/components/MatchupView/MatchupPanel";
import { StandingsSummary } from "@/components/MatchupView/StandingsSummary";
import { MyTeamPicker } from "@/components/MyTeamPicker/MyTeamPicker";
import { getProfile } from "@/lib/auth/session";
import { getActiveLeagueRecord, toLeagueSummary } from "@/lib/leagues/queries";
import { getLeagueTeams } from "@/lib/leagues/teamQueries";
import { formatWeekRange } from "@/lib/matchups/format";
import { getLeagueSeason } from "@/lib/matchups/loader";
import {
  loadMatchupSearchParams,
  MATCHUP_VIEW_LABELS,
  MATCHUP_VIEWS,
  matchupHref,
} from "@/lib/matchups/searchParams";
import { buildSeasonSummary, findMatchup, pickWeek } from "@/lib/matchups/season";
import { buildStandings } from "@/lib/matchups/standings";
import { type LeagueWeek } from "@/lib/matchups/types";
import { type RawSearchParams } from "@/lib/players/searchParams";
import { PageHeader, type PageHeaderProps } from "@vision/ui/components/PageHeader/PageHeader";
import { StatViewTabs } from "@vision/ui/components/StatViewTabs/StatViewTabs";

import {
  ImportFromYahooAction,
  LeagueGate,
  LeagueStatus,
  LeagueSyncButton,
  OpenInYahooLink,
} from "@/app/_league/LeagueGate";
import { MATCHUP_PAGE_HEADER } from "@/app/matchup/header";

import styles from "@/app/matchup/matchup.module.scss";

export const dynamic = "force-dynamic";

const STATUS_LABEL = "Matchup status";

// Every state short of the week: the page's own header (with `header`'s
// overrides), then why there is no matchup yet and what to do about it.
type MatchupGateProps = {
  message: string;
  header?: Partial<PageHeaderProps>;
  children?: ReactNode;
};

function MatchupGate({ message, header, children }: MatchupGateProps) {
  return (
    <LeagueGate
      header={{ ...MATCHUP_PAGE_HEADER, ...header }}
      label={STATUS_LABEL}
      message={message}
    >
      {children}
    </LeagueGate>
  );
}

// "Week 3, Oct 20 to Oct 26".
type WeekEyebrowProps = { week: LeagueWeek };

const weekEyebrow = ({ week }: WeekEyebrowProps): string => {
  const range = formatWeekRange(week);
  return range !== null ? `Week ${week.week}, ${range}` : `Week ${week.week}`;
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
        <ImportFromYahooAction />
      </MatchupGate>
    );
  }
  const league = toLeagueSummary({ league: record });

  if (!league.isImported) {
    return (
      <MatchupGate message="Matchups need a league imported from Yahoo, so they know the schedule and every team's totals.">
        <ImportFromYahooAction />
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

  const [{ view, week: requestedWeek }, season] = await Promise.all([
    searchParams.then((raw) => loadMatchupSearchParams(raw)),
    getLeagueSeason({ league: record }),
  ]);
  const week = pickWeek({ season, week: requestedWeek }) ?? null;

  if (week === null) {
    return (
      <MatchupGate
        header={{
          eyebrow: `${league.name} · Yahoo`,
          actions: <LeagueSyncButton league={league} />,
        }}
        message="No matchup data yet. Sync your league to load the week's scoreboard from Yahoo."
      />
    );
  }

  const myTeamId = league.myTeamId;
  const { mine, opponent } = findMatchup({ week, myTeamId });
  const opponentId = opponent?.teamId;
  // The latest week needs no week in its links, so they stay the plain URL.
  const latest = season.at(-1)?.week;
  const linkedWeek = week.week === latest ? null : week.week;

  return (
    <main className={styles.page}>
      <PageHeader
        {...MATCHUP_PAGE_HEADER}
        eyebrow={
          view === "season"
            ? `${league.name} · ${season.length === 1 ? "1 week" : `${season.length} weeks`}`
            : `${league.name} · ${weekEyebrow({ week })}`
        }
        actions={
          <>
            <LeagueSyncButton league={league} />
            {!!league.externalUrl && <OpenInYahooLink href={league.externalUrl} />}
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
          href: matchupHref({ view: entry, week: linkedWeek }),
        }))}
      />
      {view !== "season" && season.length > 1 && (
        <StatViewTabs
          label="Weeks"
          entries={season.map((entry) => ({
            key: String(entry.week),
            label: `Week ${entry.week}`,
            isActive: entry.week === week.week,
            href: matchupHref({ view, week: entry.week === latest ? null : entry.week }),
          }))}
        />
      )}
      {view === "matchup" &&
        (mine !== undefined && opponent !== undefined ? (
          <MatchupPanel week={week} mine={mine} opponent={opponent} />
        ) : (
          <LeagueStatus
            label={STATUS_LABEL}
            message={`Your team has no opponent in week ${week.week}. See the league totals instead.`}
          />
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
      {view === "season" && (
        <SeasonPanel
          teamName={mine?.name ?? "Your team"}
          summary={buildSeasonSummary({ season, myTeamId })}
        />
      )}
      <p className={styles.credit}>League data from Yahoo Fantasy</p>
    </main>
  );
}
