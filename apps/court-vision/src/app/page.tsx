import { redirect } from "next/navigation";

import { AverageToggle } from "@/components/AverageToggle/AverageToggle";
import { DashboardPanel } from "@/components/DashboardPanel/DashboardPanel";
import { HomeAdvicePanel } from "@/components/HomeAdvicePanel/HomeAdvicePanel";
import { PageAction, PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { ReadoutCard, ReadoutRow } from "@vision/ui/components/ReadoutCard/ReadoutCard";
import { HomeStarredPanel } from "@/components/HomeStarredPanel/HomeStarredPanel";
import { HomeTeamPanel } from "@/components/HomeTeamPanel/HomeTeamPanel";
import { WatchlistTrendChart } from "@/components/WatchlistTrendChart/WatchlistTrendChart";
import { getProfile } from "@/lib/auth/session";
import { featuredTeam } from "@/lib/fantasyTeams/featured";
import { getActiveLeague } from "@/lib/leagues/queries";
import { getLeagueTeams } from "@/lib/leagues/teamQueries";
import { getHomeInsights } from "@/lib/home/insights";
import { leagueValuationSettings } from "@/lib/valuation/leagueSettings";
import { formatOrdinal } from "@vision/core/util/format";
import { HOMEPAGE_WATCHLIST_LIMIT, MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { getWatchlistCount, getWatchlistPlayers } from "@/lib/watchlist/queries";
import { ROLLING_WINDOW_GAMES } from "@vision/core/valuation/rolling";
import { FANTASY_METHODS } from "@vision/sport-basketball/engine";
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

  const [players, count, league] = await Promise.all([
    getWatchlistPlayers({ limit: HOMEPAGE_WATCHLIST_LIMIT }),
    getWatchlistCount(),
    getActiveLeague(),
  ]);
  // One valuation for the whole page: the panels and every trend chart value
  // players on the same league settings and method.
  const settings = leagueValuationSettings({
    league,
    preferredFormula: profile.preferredFormula,
  });
  // Every method's chart tracks exactly the players the Starred panel lists.
  const [teams, insights, trends] = await Promise.all([
    league === null ? Promise.resolve([]) : getLeagueTeams({ leagueId: league.id }),
    getHomeInsights({ league, settings }),
    getTrendSeries({ players, settings }),
  ]);
  // Picked once so the Roster readout and the Your Team panel describe the
  // same team: the newest, the roster a manager is most likely still filling.
  const team = featuredTeam({ teams });
  const filledSlots = team === null ? 0 : team.slots.filter((slot) => slot.player !== null).length;
  const { advice, valueById, methodLabel } = insights;

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Dashboard"
        title="Command centre"
        description="Everything you follow, in one read: watchlist form, your roster by value, and who would fix its weakest categories."
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
          label="Weakest category"
          value={advice?.weakness.label ?? "—"}
          note={
            advice === null
              ? "import a Yahoo league"
              : `${formatOrdinal({ value: advice.weakness.rank })} of ${advice.weakness.of} teams`
          }
          sentiment={advice === null ? "neutral" : "down"}
        />
      </ReadoutRow>
      <div className={styles.dashboardGrid}>
        <HomeStarredPanel players={players} count={count} className={styles.panelCardLeft} />
        <HomeTeamPanel
          team={team}
          isImported={league?.isImported ?? false}
          values={valueById}
          methodLabel={methodLabel}
          className={styles.panelCardRight}
        />
        <div className={styles.adviceColumn}>
          <HomeAdvicePanel kind="trades" advice={advice} methodLabel={methodLabel} />
          <HomeAdvicePanel kind="free_agents" advice={advice} methodLabel={methodLabel} />
        </div>
        {/* One switch for every method chart below. */}
        <div className={styles.chartTools}>
          <AverageToggle />
        </div>
        <div className={styles.charts}>
          {FANTASY_METHODS.map((method) => (
            <DashboardPanel
              key={method.key}
              id={`home-${method.key}-trend-title`}
              title={`${method.label} Trend`}
            >
              <WatchlistTrendChart
                series={trends.series[method.valueKey]}
                average={trends.averages[method.valueKey]}
                caption={`Rolling ${method.label} over each player's last ${ROLLING_WINDOW_GAMES} games (fewer early in the season), against this season's player pool. ${method.description}`}
              />
            </DashboardPanel>
          ))}
        </div>
      </div>
    </main>
  );
}
