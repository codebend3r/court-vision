import { redirect } from "next/navigation";

import { HomeStandingsPanel } from "@/components/HomeStandingsPanel/HomeStandingsPanel";
import { HomeStarredPanel } from "@/components/HomeStarredPanel/HomeStarredPanel";
import { HomeTeamPanel } from "@/components/HomeTeamPanel/HomeTeamPanel";
import { WatchlistTrendChart } from "@/components/WatchlistTrendChart/WatchlistTrendChart";
import { getProfile } from "@/lib/auth/session";
import { getActiveLeague } from "@/lib/leagues/queries";
import { getLeagueTeams } from "@/lib/leagues/teamQueries";
import { getConferenceStandings } from "@/lib/standings/loader";
import { HOMEPAGE_WATCHLIST_LIMIT } from "@/lib/watchlist/constants";
import { getWatchlistCount, getWatchlistPlayers } from "@/lib/watchlist/queries";
import { ROLLING_WINDOW_GAMES } from "@/lib/watchlist/trend";
import { getGTrendSeries, getZTrendSeries } from "@/lib/watchlist/trendLoader";

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
  // Both charts track exactly the players the panel above lists.
  const [zSeries, gSeries] = await Promise.all([
    getZTrendSeries({ players }),
    getGTrendSeries({ players }),
  ]);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Court Vision</h1>
      <p className={styles.subtitle}>Your fantasy command center.</p>
      <div className={styles.dashboardGrid}>
        <HomeStarredPanel players={players} count={count} className={styles.panelCardLeft} />
        <HomeTeamPanel teams={teams} className={styles.panelCardRight} />
        <HomeStandingsPanel standings={standings} className={styles.panelCardFar} />
        <section
          className={`${styles.chartCard} ${styles.chartCardLeft}`}
          aria-labelledby="home-z-trend-title"
        >
          <h2 id="home-z-trend-title" className={styles.cardTitle}>
            Z-Score Trend
          </h2>
          <WatchlistTrendChart
            series={zSeries}
            caption={`Rolling ${ROLLING_WINDOW_GAMES}-game z-score against this season's player pool. Zero is league-average value.`}
          />
        </section>
        <section
          className={`${styles.chartCard} ${styles.chartCardRight}`}
          aria-labelledby="home-g-trend-title"
        >
          <h2 id="home-g-trend-title" className={styles.cardTitle}>
            G-Score Trend
          </h2>
          <WatchlistTrendChart
            series={gSeries}
            caption={`Rolling ${ROLLING_WINDOW_GAMES}-game G-score: the z-score damped by each category's game-to-game volatility. Zero is league-average value.`}
          />
        </section>
      </div>
    </main>
  );
}
