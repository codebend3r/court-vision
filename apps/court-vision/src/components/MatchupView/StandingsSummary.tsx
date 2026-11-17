import { formatOrdinal } from "@vision/core/util/format";

import { type CategoryStanding } from "@/lib/matchups/standings";

import styles from "@/components/MatchupView/MatchupView.module.scss";

export type StandingExtreme = "best" | "worst";

// Whether a place is the league's best or worst in its category, for the
// `data-extreme` tint and the words that back it up.
type ExtremeOfProps = Pick<CategoryStanding, "isBest" | "isWorst">;

export const extremeOf = ({ isBest, isWorst }: ExtremeOfProps): StandingExtreme | undefined => {
  if (isBest) return "best";
  if (isWorst) return "worst";
  return undefined;
};

const EXTREME_BADGES: Record<StandingExtreme, string> = {
  best: "Best in league",
  worst: "Worst in league",
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
          const extreme = extremeOf(standing);
          return (
            <li key={standing.category.statId} className={styles.standing} data-extreme={extreme}>
              <span className={styles.standingLabel}>{standing.category.label}</span>
              <span className={styles.standingRank}>
                {formatOrdinal({ value: standing.rank })}
                <span className={styles.standingOf}> of {standing.of}</span>
              </span>
              {!!extreme && <span className={styles.standingBadge}>{EXTREME_BADGES[extreme]}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
