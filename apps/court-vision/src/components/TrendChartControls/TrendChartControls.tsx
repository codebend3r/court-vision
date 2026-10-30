"use client";

import { AverageToggle } from "@/components/AverageToggle/AverageToggle";
import { VALUE_LABELS } from "@/components/PlayerFantasyChart/labels";
import {
  TREND_SPAN_LABELS,
  TREND_SPANS,
  toggleMethod,
  type TrendSpan,
  visibleMethods,
} from "@/lib/charts/trendMethods";
import { useTrendChartPrefs } from "@/components/TrendChartControls/useTrendChartPrefs";
import { METHOD_VALUE_KEYS } from "@vision/core/valuation/registry";

import styles from "@/components/TrendChartControls/TrendChartControls.module.scss";

// The timeframe is the one setting a page may own itself (the player page has
// its own range picker), so it is the only one passed in; which charts show
// and the average line come from the shared URL settings.
export type TrendChartControlsProps = {
  span?: TrendSpan;
  onSpan?: (span: TrendSpan) => void;
};

// The rolling charts' controls: which of the seven method charts show (any
// can be hidden but the last), the timeframe, and the league-average line.
export function TrendChartControls({ span, onSpan }: TrendChartControlsProps) {
  const { hidden, setHidden } = useTrendChartPrefs();
  const visible = visibleMethods({ hidden });
  return (
    <span className={styles.controls}>
      <span className={styles.group} role="group" aria-label="Charts shown">
        <span className={styles.groupLabel} aria-hidden="true">
          Charts
        </span>
        {METHOD_VALUE_KEYS.map((key) => {
          const isOn = visible.includes(key);
          const isLast = isOn && visible.length === 1;
          return (
            <button
              key={key}
              type="button"
              className={styles.option}
              aria-pressed={isOn}
              // The last chart on stays on; the title says why the key is dead.
              disabled={isLast}
              title={isLast ? "At least one chart stays on" : undefined}
              onClick={() => setHidden(toggleMethod({ hidden, key }))}
            >
              {VALUE_LABELS[key]}
            </button>
          );
        })}
        {!!hidden.length && (
          <button type="button" className={styles.option} onClick={() => setHidden([])}>
            Show all
          </button>
        )}
      </span>
      {span !== undefined && onSpan !== undefined && (
        <span className={styles.group} role="group" aria-label="Timeframe">
          <span className={styles.groupLabel} aria-hidden="true">
            Timeframe
          </span>
          {TREND_SPANS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={styles.option}
              aria-pressed={span === entry}
              onClick={() => onSpan(entry)}
            >
              {TREND_SPAN_LABELS[entry]}
            </button>
          ))}
        </span>
      )}
      <AverageToggle />
    </span>
  );
}
