import styles from "@/components/FantasyValueLegend/FantasyValueLegend.module.scss";
import { FANTASY_METHODS } from "@/lib/valuation/registry";
import type { Basis } from "@/lib/valuation/types";

export type FantasyValueLegendProps = {
  poolSize: number;
  windowLabel: string;
  basis: Basis;
};

// The Fantasy tab's counterpart to AdvancedStatsLegend: one collapsed card
// explaining every method column, the shared pool, and the weight semantics.
export function FantasyValueLegend({ poolSize, windowLabel, basis }: FantasyValueLegendProps) {
  const basisLabel = basis === "perGame" ? "per-game averages" : "totals";
  return (
    <details className={styles.legend}>
      <summary className={styles.summary}>
        <span className={styles.chevron} aria-hidden="true">
          ▸
        </span>
        How is value calculated?
      </summary>
      <dl className={styles.grid}>
        {FANTASY_METHODS.map((method) => (
          <div key={method.key} className={styles.row}>
            <dt className={styles.term}>{method.label}</dt>
            <dd className={styles.desc}>
              <span>
                <strong>{method.fullName}.</strong> {method.description}
              </span>
              {method.available ? (
                <code className={styles.formula}>{method.formula}</code>
              ) : (
                <span className={styles.blocked}>{method.unavailableReason ?? ""}</span>
              )}
            </dd>
          </div>
        ))}
        <div className={styles.row}>
          <dt className={styles.term}>Pool</dt>
          <dd className={styles.desc}>
            <span>
              Z-Score and G-Score standardize against the top {poolSize} qualifying players (
              {windowLabel}, {basisLabel}); everyone else is scored against that pool without
              shifting it. Percentages count through attempt volume, so 55% on 20 shots beats 90% on
              2.
            </span>
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>Weights</dt>
          <dd className={styles.desc}>
            <span>
              Category chips and weights shape the category-based scores (Z-Score, G-Score, and
              their VORP columns). A weight of 0 punts the category; excluding removes it. Points
              ignores weights — it uses points-league scoring. Teams × roster slots sets the pool
              size and the VORP replacement rank.
            </span>
          </dd>
        </div>
      </dl>
    </details>
  );
}
