import { formatOrdinal } from "@vision/core/util/format";

import { type CategoryStanding } from "@/lib/matchups/standings";

import styles from "@/components/MatchupView/MatchupView.module.scss";

type BadgeForProps = { standing: CategoryStanding };

const badgeFor = ({ standing }: BadgeForProps): string | null => {
  if (standing.isBest) return "Best in league";
  if (standing.isWorst) return "Worst in league";
  return null;
};

// Where your team's totals place in every category this week, so the best and
// the worst of them are visible without reading the whole table.
type StandingsSummaryProps = {
  standings: readonly CategoryStanding[];
  teamName: string;
};

export function StandingsSummary({ standings, teamName }: StandingsSummaryProps) {
  return (
    <section className={styles.summary} aria-label={`${teamName} standing by category`}>
      <h2 className={styles.summaryTitle}>Where you stand</h2>
      <ul className={styles.summaryList}>
        {standings.map((standing) => {
          const badge = badgeFor({ standing });
          return (
            <li
              key={standing.category.statId}
              className={styles.standing}
              data-extreme={standing.isBest ? "best" : standing.isWorst ? "worst" : undefined}
            >
              <span className={styles.standingLabel}>{standing.category.label}</span>
              <span className={styles.standingRank}>
                {formatOrdinal({ value: standing.rank })}
                <span className={styles.standingOf}> of {standing.of}</span>
              </span>
              {!!badge && <span className={styles.standingBadge}>{badge}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
