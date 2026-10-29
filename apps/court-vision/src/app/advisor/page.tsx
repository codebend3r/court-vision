import { redirect } from "next/navigation";
import { type ReactNode } from "react";

import { AdvisorView } from "@/components/AdvisorView/AdvisorView";
import { MyTeamPicker } from "@/components/MyTeamPicker/MyTeamPicker";
import { SyncYahooButton } from "@/components/SyncYahooButton/SyncYahooButton";
import { getAdvisorLeagueData } from "@/lib/advisor/loader";
import { loadAdvisorSearchParams } from "@/lib/advisor/searchParams";
import { getProfile } from "@/lib/auth/session";
import { getActiveRosterPlayers } from "@/lib/fantasyTeams/loader";
import { buildLeagueSeed, configFromSeed } from "@/lib/leagues/fantasyDefaults";
import { getActiveLeague } from "@/lib/leagues/queries";
import { getLeagueTeams } from "@/lib/leagues/teamQueries";
import { type RawSearchParams } from "@/lib/players/searchParams";
import { getFantasyPool } from "@/lib/valuation/loader";
import { notValuedMessage } from "@/lib/yahoo/messages";
import { PageAction, PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { FANTASY_METHODS } from "@vision/sport-basketball/engine";

import { ADVISOR_PAGE_HEADER } from "@/app/advisor/header";

import styles from "@/app/advisor/advisor.module.scss";

export const dynamic = "force-dynamic";

const IMPORT_PATH = "/leagues/import";

// Every state short of the advice: the page's own header, then why the
// advisor can't run yet and what to do about it.
type AdvisorGateProps = { message: string; children?: ReactNode };

function AdvisorGate({ message, children }: AdvisorGateProps) {
  return (
    <main className={styles.page}>
      <PageHeader {...ADVISOR_PAGE_HEADER} />
      <section className={styles.gate} aria-label="Roster Advisor status">
        <p className={styles.message}>{message}</p>
        {children}
      </section>
    </main>
  );
}

type AdvisorPageProps = {
  searchParams: Promise<RawSearchParams>;
};

export default async function AdvisorPage({ searchParams }: AdvisorPageProps) {
  const [profile, league] = await Promise.all([getProfile(), getActiveLeague()]);
  if (profile === null) redirect("/login?next=/advisor");

  if (league === null) {
    return (
      <AdvisorGate message="No league yet. Import your Yahoo league to find your team's biggest weakness.">
        <PageAction href={IMPORT_PATH}>Import from Yahoo</PageAction>
      </AdvisorGate>
    );
  }

  if (!league.isImported) {
    return (
      <AdvisorGate message="The Roster Advisor needs a league imported from Yahoo, so it knows every team's roster.">
        <PageAction href={IMPORT_PATH}>Import from Yahoo</PageAction>
      </AdvisorGate>
    );
  }

  if (league.scoringType === "h2h_points") {
    return (
      <AdvisorGate message="The Roster Advisor works by category, so it doesn't support points leagues." />
    );
  }

  if (league.myTeamId === null) {
    const teams = await getLeagueTeams({ leagueId: league.id });
    return (
      <AdvisorGate message="Which team is yours?">
        <MyTeamPicker leagueId={league.id} teams={teams} />
      </AdvisorGate>
    );
  }

  const { range } = loadAdvisorSearchParams(await searchParams);
  const [lines, leagueData, activeRoster] = await Promise.all([
    getFantasyPool({ range }),
    getAdvisorLeagueData({ leagueId: league.id, myTeamId: league.myTeamId }),
    getActiveRosterPlayers(),
  ]);
  const method =
    FANTASY_METHODS.find((entry) => entry.key === profile.preferredFormula)?.key ?? "zscore";
  // The Fantasy tab's first load for this league, as the Waiver Wire does, so
  // a player's value here matches every other screen.
  const { config, methodWeights } = configFromSeed({
    seed: buildLeagueSeed({ league, preferredFormula: null, presentKeys: new Set() }),
  });

  return (
    <main className={styles.page}>
      <PageHeader
        {...ADVISOR_PAGE_HEADER}
        eyebrow={`${league.name} · Yahoo`}
        actions={
          <SyncYahooButton
            leagueId={league.id}
            syncedAt={league.syncedAt}
            syncError={league.syncError}
            syncVia={league.syncVia}
            externalUrl={league.externalUrl}
            autoSyncWhenStale
          />
        }
      />
      {!!league.unsupportedCategories.length && (
        <p className={styles.warning}>
          {notValuedMessage({ categories: league.unsupportedCategories })}
        </p>
      )}
      <AdvisorView
        range={range}
        lines={lines}
        league={leagueData}
        activePlayerIds={activeRoster.map((player) => player.playerId)}
        config={config}
        methodWeights={methodWeights}
        method={method}
      />
      <p className={styles.credit}>League data from Yahoo Fantasy</p>
    </main>
  );
}
