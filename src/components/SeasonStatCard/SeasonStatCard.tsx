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

export function SeasonStatCard({
  season,
  stats,
  title = "Season averages",
}: {
  season: string;
  stats: SeasonAverageStat[];
  title?: string;
}) {
  if (!stats.length) {
    return null;
  }

  return (
    <section className={styles.card} aria-labelledby="season-averages-title">
      <header className={styles.cardHeader}>
        <h2 id="season-averages-title" className={styles.title}>
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
                title={`${formatOrdinal({ value: stat.rank })} of ${stat.eligibleCount} qualified players`}
              >
                {formatOrdinal({ value: stat.rank })} in NBA
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
