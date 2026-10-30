"use client";

import { useId } from "react";

import { useTrendChartPrefs } from "@/components/TrendChartControls/useTrendChartPrefs";

import styles from "@/components/AverageToggle/AverageToggle.module.scss";

// The trend charts' "League average" switch: on by default, it draws the
// league's average form on each game date as a dotted line, so a player's
// form reads against the league rather than against zero. One switch drives
// every chart on the page through the URL (`?avg=false`).
export function AverageToggle() {
  const id = useId();
  const { showAverage, setShowAverage } = useTrendChartPrefs();
  return (
    <span className={styles.toggle}>
      <input
        id={id}
        type="checkbox"
        className={styles.checkbox}
        checked={showAverage}
        onChange={(event) => setShowAverage(event.target.checked)}
      />
      <label htmlFor={id} className={styles.label}>
        League average
        <svg className={styles.mark} viewBox="0 0 24 8" aria-hidden="true">
          <line x1="0" y1="4" x2="24" y2="4" strokeDasharray="3 3" />
        </svg>
      </label>
    </span>
  );
}
