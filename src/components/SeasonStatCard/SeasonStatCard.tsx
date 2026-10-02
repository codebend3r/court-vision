import { useId } from "react";

import { formatOrdinal } from "@/lib/players/format";
import type { RankTone, SeasonAverageStat } from "@/lib/players/seasonAverages";

import styles from "@/components/SeasonStatCard/SeasonStatCard.module.scss";

type RankTier = "first" | "elite" | "strong" | "regular";

// Tint only ranks that read as achievements; neutral-toned stats (turnovers)
// keep the plain pill however high they sit on the leaderboard.
const rankTier = ({ rank, tone }: { rank: number; tone: RankTone }): RankTier =>
  tone === "neutral"
    ? "regular"
    : rank === 1
      ? "first"
      : rank <= 5
        ? "elite"
        : rank <= 20
          ? "strong"
          : "regular";

// The headline readout card the player page opens each view with: season
// averages, advanced averages, or fantasy value, all in one shape. The rank
// pill names the scope it ranks in and the tooltip the pool it counts.
export function SeasonStatCard({
  season,
  stats,
  title = "Season averages",
  rankScope = "in NBA",
  poolNoun = "qualified players",
}: {
  season: string;
  stats: SeasonAverageStat[];
  title?: string;
  rankScope?: string;
  poolNoun?: string;
}) {
  const titleId = useId();
  if (!stats.length) {
    return null;
  }

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
            {stat.rank !== null && (
              <dd
                className={styles.rank}
                data-tier={rankTier({ rank: stat.rank, tone: stat.rankTone })}
                title={`${formatOrdinal({ value: stat.rank })} of ${stat.eligibleCount} ${poolNoun}`}
              >
                {formatOrdinal({ value: stat.rank })} {rankScope}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
