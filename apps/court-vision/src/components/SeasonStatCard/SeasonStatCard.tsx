import { useId } from "react";

import { formatOrdinal } from "@vision/core/util/format";
import type { RankTone } from "@vision/core/series/leaders";

import styles from "@/components/SeasonStatCard/SeasonStatCard.module.scss";

// One readout on the card. `rank` is where the stat sits on its leaderboard
// and how many players that board counts; a stat with no leaderboard (a
// career line, an advanced average) has none and shows no pill.
export type SeasonStat = {
  key: string;
  label: string;
  value: string;
  rank?: { position: number; tone: RankTone; eligibleCount: number };
};

type RankTier = "first" | "elite" | "strong" | "regular";

// Tint only ranks that read as achievements; neutral-toned stats (turnovers)
// keep the plain pill however high they sit on the leaderboard.
const rankTier = ({ position, tone }: { position: number; tone: RankTone }): RankTier =>
  tone === "neutral"
    ? "regular"
    : position === 1
      ? "first"
      : position <= 5
        ? "elite"
        : position <= 20
          ? "strong"
          : "regular";

// The headline readout card the player page opens each view with: season
// averages, advanced averages, or fantasy value, all in one shape. The rank
// pill names its place in the NBA and the tooltip the pool it counts. Callers
// render it only when they have stats to show.
export function SeasonStatCard({
  season,
  stats,
  title = "Season averages",
  poolNoun = "qualified players",
}: {
  season: string;
  stats: readonly SeasonStat[];
  title?: string;
  poolNoun?: string;
}) {
  const titleId = useId();

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <header className={styles.cardHeader}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <span className={styles.season}>{season}</span>
      </header>
      <dl className={styles.grid}>
        {stats.map((stat) => (
          <div key={stat.key} className={styles.stat}>
            <dt className={styles.label}>{stat.label}</dt>
            <dd className={styles.value}>{stat.value}</dd>
            {!!stat.rank && (
              <dd
                className={styles.rank}
                data-tier={rankTier(stat.rank)}
                title={`${formatOrdinal({ value: stat.rank.position })} of ${stat.rank.eligibleCount} ${poolNoun}`}
              >
                {formatOrdinal({ value: stat.rank.position })} in NBA
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
