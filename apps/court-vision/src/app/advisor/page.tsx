import { redirect } from "next/navigation";

import { AdvisorView } from "@/components/AdvisorView/AdvisorView";
import { getAdvisorLeagueData } from "@/lib/advisor/loader";
import { loadAdvisorSearchParams } from "@/lib/advisor/searchParams";
import { freePlayerIds, TREND_RANGE } from "@/lib/advisor/trending";
import { getProfile } from "@/lib/auth/session";
import { getActiveRosterPlayers } from "@/lib/fantasyTeams/loader";
import { getActiveLeague } from "@/lib/leagues/queries";
import { type BlockedRosterGateKind, rosterGate } from "@/lib/leagues/rosterGate";
import { type RawSearchParams } from "@/lib/players/searchParams";
import { leagueValuationSettings } from "@/lib/valuation/leagueSettings";
import { getFantasyPool } from "@/lib/valuation/loader";
import { notValuedMessage } from "@/lib/yahoo/messages";
import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";

import { LeagueSyncButton } from "@/app/_league/LeagueGate";
import { rosterGateScreen } from "@/app/_league/rosterGateScreen";
import { ADVISOR_PAGE_HEADER } from "@/app/advisor/header";

import styles from "@/app/advisor/advisor.module.scss";

export const dynamic = "force-dynamic";

// Why the advisor can't run yet, for each state that blocks it.
const ADVISOR_GATE_MESSAGES: Record<BlockedRosterGateKind, string> = {
  no_league: "No league yet. Import your Yahoo league to find your team's biggest weakness.",
  not_imported:
    "The Roster Advisor needs a league imported from Yahoo, so it knows every team's roster.",
  points: "The Roster Advisor works by category, so it doesn't support points leagues.",
};

type AdvisorPageProps = {
  searchParams: Promise<RawSearchParams>;
};

export default async function AdvisorPage({ searchParams }: AdvisorPageProps) {
  const [profile, activeLeague] = await Promise.all([getProfile(), getActiveLeague()]);
  if (profile === null) redirect("/login?next=/advisor");

  const gate = rosterGate({ league: activeLeague });
  if (gate.kind !== "ready") {
    return rosterGateScreen({
      gate,
      header: ADVISOR_PAGE_HEADER,
      label: "Roster Advisor status",
      messages: ADVISOR_GATE_MESSAGES,
    });
  }
  const { league, myTeamId } = gate;

  const { range } = loadAdvisorSearchParams(await searchParams);
  const [lines, seasonLines, recentLines, leagueData, activeRoster] = await Promise.all([
    getFantasyPool({ range }),
    getFantasyPool({ range: "all" }),
    getFantasyPool({ range: TREND_RANGE }),
    getAdvisorLeagueData({ leagueId: league.id, myTeamId }),
    getActiveRosterPlayers(),
  ]);
  const activePlayerIds = activeRoster.map((player) => player.playerId);
  // Only the free players' lines cross to the client for the trend list.
  const freeIds = freePlayerIds({ league: leagueData, activePlayerIds });
  const trendLines = {
    season: seasonLines.filter((line) => freeIds.has(line.playerId)),
    recent: recentLines.filter((line) => freeIds.has(line.playerId)),
  };
  const { method, config, methodWeights } = leagueValuationSettings({
    league,
    preferredFormula: profile.preferredFormula,
  });

  return (
    <main className={styles.page}>
      <PageHeader
        {...ADVISOR_PAGE_HEADER}
        eyebrow={`${league.name} · Yahoo`}
        actions={<LeagueSyncButton league={league} />}
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
        activePlayerIds={activePlayerIds}
        trendLines={trendLines}
        config={config}
        methodWeights={methodWeights}
        method={method}
      />
      <p className={styles.credit}>League data from Yahoo Fantasy</p>
    </main>
  );
}
