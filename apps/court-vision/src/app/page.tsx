import { redirect } from "next/navigation";

import { DashboardPanel } from "@/components/DashboardPanel/DashboardPanel";
import { HomeStandingsPanel } from "@/components/HomeStandingsPanel/HomeStandingsPanel";
import { PageAction, PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { ReadoutCard, ReadoutRow } from "@vision/ui/components/ReadoutCard/ReadoutCard";
import { HomeStarredPanel } from "@/components/HomeStarredPanel/HomeStarredPanel";
import { HomeTeamPanel } from "@/components/HomeTeamPanel/HomeTeamPanel";
import { WatchlistTrendChart } from "@/components/WatchlistTrendChart/WatchlistTrendChart";
import { getProfile } from "@/lib/auth/session";
import { featuredTeam } from "@/lib/fantasyTeams/featured";
import { getActiveLeague } from "@/lib/leagues/queries";
import { getLeagueTeams } from "@/lib/leagues/teamQueries";
import { getConferenceStandings } from "@/lib/standings/loader";
import { HOMEPAGE_WATCHLIST_LIMIT, MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { getWatchlistCount, getWatchlistPlayers } from "@/lib/watchlist/queries";
import { ROLLING_WINDOW_GAMES } from "@vision/core/valuation/rolling";
import { getTrendSeries } from "@/lib/watchlist/trendLoader";

import styles from "@/app/page.module.scss";

export default async function Home() {
  const profile = await getProfile();

  // Signed out, the homepage is the login form: /login renders it inside the
  // normal shell (header and footer included) and sends users back here once
  // they sign in.
  if (profile === null) {
    redirect("/login");
  }

  const [players, count, standings, league] = await Promise.all([
    getWatchlistPlayers({ limit: HOMEPAGE_WATCHLIST_LIMIT }),
    getWatchlistCount(),
    getConferenceStandings(),
    getActiveLeague(),
  ]);
  const teams = league === null ? [] : await getLeagueTeams({ leagueId: league.id });
  // Picked once so the Roster readout and the Your Team panel describe the
  // same team: the newest, the roster a manager is most likely still filling.
  const team = featuredTeam({ teams });
  const filledSlots = team === null ? 0 : team.slots.filter((slot) => slot.player !== null).length;
  const eastLeader = standings?.east[0] ?? null;
  // Both charts track exactly the players the panel above lists.
  const { z: zSeries, g: gSeries } = await getTrendSeries({ players });

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Dashboard"
        title="Command centre"
        description="Everything you follow, in one read: watchlist form, your roster, and where the league actually stands."
        actions={<PageAction href="/players">Open players</PageAction>}
      />
      <ReadoutRow>
        <ReadoutCard label="Watchlist" value={count} note={`of ${MAX_WATCHLIST} slots`} />
        <ReadoutCard
          label="Roster"
          value={team === null ? "—" : `${filledSlots}/${team.slots.length}`}
          note={team?.name ?? "no teams yet"}
          sentiment={team !== null && filledSlots === team.slots.length ? "up" : "neutral"}
        />
        <ReadoutCard
          label="League"
          value={league === null ? "—" : `${league.teamCount}-team`}
          note={league?.name ?? "create a league"}
        />
        <ReadoutCard
          label="East leader"
          value={eastLeader === null ? "—" : eastLeader.abbreviation}
          note={
            eastLeader === null ? "standings pending" : `${eastLeader.wins}–${eastLeader.losses}`
          }
        />
      </ReadoutRow>
      <div className={styles.dashboardGrid}>
        <HomeStarredPanel players={players} count={count} className={styles.panelCardLeft} />
        <HomeTeamPanel
          team={team}
          isImported={league?.isImported ?? false}
          className={styles.panelCardRight}
        />
        <HomeStandingsPanel standings={standings} className={styles.panelCardFar} />
        <DashboardPanel
          id="home-z-trend-title"
          title="Z-Score Trend"
          className={styles.chartCardLeft}
        >
          <WatchlistTrendChart
            series={zSeries}
            caption={`Rolling ${ROLLING_WINDOW_GAMES}-game z-score against this season's player pool. Zero is league-average value.`}
          />
        </DashboardPanel>
        <DashboardPanel
          id="home-g-trend-title"
          title="G-Score Trend"
          className={styles.chartCardRight}
        >
          <WatchlistTrendChart
            series={gSeries}
            caption={`Rolling ${ROLLING_WINDOW_GAMES}-game G-score: the z-score damped by each category's game-to-game volatility. Zero is league-average value.`}
          />
        </DashboardPanel>
      </div>
    </main>
  );
}
