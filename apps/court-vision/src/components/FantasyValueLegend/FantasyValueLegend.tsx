import { FANTASY_METHODS } from "@/lib/valuation/registry";
import { type Basis } from "@/lib/valuation/types";

import styles from "@/components/FantasyValueLegend/FantasyValueLegend.module.scss";

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
              <span className={styles.why}>
                <strong className={styles.whyLabel}>Why it matters:</strong> {method.whyItMatters}
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
              Every method column keeps its own weight set: the Weights panel edits whichever column
              the table is sorted by, and a weight tuned for one column never reshapes another. A
              weight of 0 punts the category; excluding a chip removes it from every column. PL
              Linear ignores weights — it uses the Scoring table instead. Teams × roster slots sets
              the pool size, the VORP replacement rank, and the synthetic league that SGP and Sim
              Value measure against.
            </span>
          </dd>
        </div>
      </dl>
    </details>
  );
}
