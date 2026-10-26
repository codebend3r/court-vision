import type { Metadata } from "next";

import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayerGameLogTable } from "@/components/PlayerGameLogTable/PlayerGameLogTable";
import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
import { PlayerStatFilters } from "@/components/PlayerStatFilters/PlayerStatFilters";
import { PlayerViewTabs } from "@/components/PlayerViewTabs/PlayerViewTabs";
import { SeasonSelect } from "@/components/SeasonSelect/SeasonSelect";
import { SeasonStatCard, type SeasonStat } from "@/components/SeasonStatCard/SeasonStatCard";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import {
  FIXTURE_GAME_LOG_ROWS,
  FIXTURE_PROFILE_PLAYER,
  FIXTURE_SOURCE_LOGS,
} from "@/lib/players/fixture";
import { buildStatSeries } from "@/lib/stats/cumulative";
import { SEASON_LABEL } from "@/lib/stats/season";

import styles from "@/app/design/player/page.module.scss";

// A synthetic perf fixture, not a product page: nothing here should be indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

type AverageProps = { total: number };

const average = ({ total }: AverageProps): string =>
  (total / FIXTURE_GAME_LOG_ROWS.length).toFixed(1);

type SumOfProps = { pick: (row: (typeof FIXTURE_GAME_LOG_ROWS)[number]) => number };

const sumOf = ({ pick }: SumOfProps) =>
  FIXTURE_GAME_LOG_ROWS.reduce((total, row) => total + pick(row), 0);

const SEASON_STATS: readonly SeasonStat[] = [
  { key: "pts", label: "PTS", value: average({ total: sumOf({ pick: (row) => row.pts }) }) },
  { key: "reb", label: "REB", value: average({ total: sumOf({ pick: (row) => row.reb }) }) },
  { key: "ast", label: "AST", value: average({ total: sumOf({ pick: (row) => row.ast }) }) },
  { key: "stl", label: "STL", value: average({ total: sumOf({ pick: (row) => row.stl }) }) },
  { key: "blk", label: "BLK", value: average({ total: sumOf({ pick: (row) => row.blk }) }) },
];

// The regular view of a 60 game player page: the view tabs, header, season card,
// running chart and game log are the production components over fixed data, so
// Lighthouse measures their real client cost (recharts included) with no
// database.
export default function DesignPlayerPage() {
  const player = FIXTURE_PROFILE_PLAYER;
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Reference"
        title="Player fixture"
        description="One synthetic player and 60 games through the production player page. It exists so CI can time the profile without a database."
      />
      <PlayerViewTabs active="regular" />
      <header className={styles.header}>
        <PlayerAvatar
          fullName={player.fullName}
          nbaPersonId={player.nbaPersonId}
          size="lg"
          teamAbbr={player.teamAbbr}
        />
        <p className={styles.meta}>
          {!!player.teamAbbr && <TeamChip team={player.teamAbbr} size="sm" />}
          {!!player.position && <span>{player.position}</span>}
          <SeasonSelect seasons={[SEASON_LABEL]} value={SEASON_LABEL} />
          <span>{FIXTURE_GAME_LOG_ROWS.length} games</span>
        </p>
        <div className={styles.headerCard}>
          <SeasonStatCard season={SEASON_LABEL} stats={[...SEASON_STATS]} />
        </div>
      </header>
      <section className={styles.view} aria-label="Stat view">
        <PlayerStatFilters />
        <PlayerStatChart
          series={buildStatSeries({ logs: FIXTURE_SOURCE_LOGS, mode: "game" })}
          mode="game"
        />
      </section>
      <PlayerGameLogTable view="regular" rows={FIXTURE_GAME_LOG_ROWS} />
    </main>
  );
}
