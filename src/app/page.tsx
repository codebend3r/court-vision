import Link from "next/link";

import { ComingSoonPanel } from "@/components/ComingSoonPanel/ComingSoonPanel";
import { HomeStarredPanel } from "@/components/HomeStarredPanel/HomeStarredPanel";
import { HomeTeamPanel } from "@/components/HomeTeamPanel/HomeTeamPanel";
import { WatchlistZChart } from "@/components/WatchlistZChart/WatchlistZChart";
import { getProfile } from "@/lib/auth/session";
import { HOMEPAGE_WATCHLIST_LIMIT } from "@/lib/watchlist/constants";
import { getWatchlistCount, getWatchlistPlayers } from "@/lib/watchlist/queries";
import { getZTrendSeries } from "@/lib/watchlist/zTrendLoader";

import styles from "@/app/page.module.scss";

export default async function Home() {
  const profile = await getProfile();

  if (profile === null) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Court Vision</h1>
        <p className={styles.subtitle}>
          Your fantasy command center &mdash; here&apos;s what&apos;s coming.
        </p>
        <div className={styles.grid}>
          <section className={styles.signInCard} aria-labelledby="home-team-title">
            <h2 id="home-team-title" className={styles.cardTitle}>
              Your Team
            </h2>
            <p className={styles.cardBody}>
              <Link href="/login">Sign in</Link> to start building your team.
            </p>
          </section>
          <section className={styles.signInCard} aria-labelledby="home-watchlist-title">
            <h2 id="home-watchlist-title" className={styles.cardTitle}>
              Starred Players
            </h2>
            <p className={styles.cardBody}>
              <Link href="/login">Sign in</Link> to star players.
            </p>
          </section>
          <ComingSoonPanel
            title="Stat Trends to Watch"
            description="Short on rebounds? We'll surface players trending up in the stats your team needs."
          />
        </div>
      </main>
    );
  }

  const [players, count] = await Promise.all([
    getWatchlistPlayers({ limit: HOMEPAGE_WATCHLIST_LIMIT }),
    getWatchlistCount(),
  ]);
  // The chart tracks exactly the players the panel above lists.
  const series = await getZTrendSeries({ players });

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Court Vision</h1>
      <p className={styles.subtitle}>Your fantasy command center.</p>
      <div className={styles.grid}>
        <HomeStarredPanel players={players} count={count} />
        <HomeTeamPanel />
        <section className={styles.chartCard} aria-labelledby="home-trend-title">
          <h2 id="home-trend-title" className={styles.cardTitle}>
            Z-Score Trend
          </h2>
          <WatchlistZChart series={series} />
        </section>
      </div>
    </main>
  );
}
