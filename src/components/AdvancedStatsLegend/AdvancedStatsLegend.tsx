import { ADVANCED_STAT_META } from "@/lib/players/advancedStatMeta";

import styles from "./AdvancedStatsLegend.module.scss";

export function AdvancedStatsLegend() {
  return (
    <details className={styles.legend}>
      <summary className={styles.summary}>
        <span className={styles.chevron} aria-hidden="true">
          ▸
        </span>
        What do these stats mean?
      </summary>
      <dl className={styles.grid}>
        {ADVANCED_STAT_META.map((meta) => (
          <div key={meta.key} className={styles.row}>
            <dt className={styles.abbr}>{meta.label}</dt>
            <dd className={styles.desc}>
              <span>
                <strong>{meta.fullName}.</strong> {meta.description}
              </span>
              <code className={styles.formula}>{meta.formula}</code>
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
