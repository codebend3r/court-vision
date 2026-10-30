import { formatScore } from "@vision/core/util/format";
import { type Advice, type AdvisorFocus } from "@/lib/advisor/types";
import { formatOrdinal } from "@vision/core/util/format";

import styles from "@/components/AdvisorView/AdvisorView.module.scss";

type OnFocusProps = { focus: AdvisorFocus };

export type NeedsPanelProps = {
  advice: Advice;
  onFocus: ({ focus }: OnFocusProps) => void;
};

// Where the roster is weak: each weak category's place in the league, every
// category ranked, and the keycaps that choose what the fits below fix (all
// weak categories at once, or one of them).
export function NeedsPanel({ advice, onFocus }: NeedsPanelProps) {
  const { weakNeeds, needs, focus } = advice;
  const weakKeys = new Set(weakNeeds.map(({ key }) => key));
  const allLabel = weakNeeds.map(({ label }) => label).join(" + ");
  return (
    <section className={styles.panel} aria-labelledby="advisor-needs">
      <h2 id="advisor-needs" className={styles.panelTitle}>
        {weakNeeds.length === 1 ? "Biggest weakness" : "Biggest weaknesses"}
      </h2>
      <ul className={styles.readouts}>
        {weakNeeds.map((need) => (
          <li key={need.key} className={styles.readout}>
            <span className={styles.readoutValue}>{need.label}</span>
            <span className={styles.readoutRank}>
              {formatOrdinal({ value: need.rank })} of {need.of}
            </span>
            <span className={styles.hint}>
              You {formatScore({ value: need.myTotal })}, league{" "}
              {formatScore({ value: need.leagueAverage })}
            </span>
          </li>
        ))}
      </ul>
      <ol className={styles.needs} aria-label="Every category, weakest first">
        {needs.map((need) => (
          <li
            key={need.key}
            className={styles.need}
            data-weakest={weakKeys.has(need.key) || undefined}
          >
            <span className={styles.needLabel}>{need.label}</span>
            <span className={styles.needRank}>
              {formatOrdinal({ value: need.rank })}
              <span className={styles.hint}> of {need.of}</span>
            </span>
          </li>
        ))}
      </ol>
      {weakNeeds.length > 1 && (
        <fieldset className={styles.keycapGroup}>
          <legend className={styles.legend}>Find players for</legend>
          <button
            type="button"
            className={styles.keycap}
            aria-pressed={focus === "all"}
            onClick={() => onFocus({ focus: "all" })}
          >
            All: {allLabel}
          </button>
          {weakNeeds.map((need) => (
            <button
              key={need.key}
              type="button"
              className={styles.keycap}
              aria-pressed={focus === need.key}
              onClick={() => onFocus({ focus: need.key })}
            >
              {need.label}
            </button>
          ))}
        </fieldset>
      )}
    </section>
  );
}
