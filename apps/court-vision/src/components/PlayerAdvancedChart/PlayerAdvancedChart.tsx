"use client";

import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";

import {
  ADVANCED_STAT_META,
  advancedStatMeta,
  formatAdvancedStat,
} from "@/lib/players/advancedStatMeta";
import { ADVANCED_METRIC_KEYS, type AdvancedMetricKey } from "@/lib/players/searchParams";
import type { AdvancedPoint, AdvancedSeriesMode } from "@/lib/stats/advancedSeries";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { MetricLineChart, type MetricMeta } from "@/components/MetricLineChart/MetricLineChart";
import { getSeriesPalette } from "@/components/PlayerStatChart/statMeta";
import { Switch } from "@/components/Switch/Switch";

import { ADVANCED_PANELS } from "@/components/PlayerAdvancedChart/advancedChartMeta";
import styles from "@/components/PlayerAdvancedChart/PlayerAdvancedChart.module.scss";

const isMetricKey = (value: string): value is AdvancedMetricKey =>
  ADVANCED_METRIC_KEYS.some((key) => key === value);

const parseVisibleMetrics = (value: string | null): AdvancedMetricKey[] =>
  value === null ? [...ADVANCED_METRIC_KEYS] : value.split(",").filter(isMetricKey);

const CAPTION_BY_MODE: Record<AdvancedSeriesMode, string> = {
  game: "Per-game values",
  avg: "Running averages",
};

// Axis ticks for share panels read as whole percentages; ratings and ratios
// keep the raw number.
const formatPercentTick = (value: number): string => `${Math.round(value * 100)}%`;

// Past this many lines the end labels collide where the metrics converge; the
// chips and the tooltip carry identity for the denser panels.
const MAX_LABELLED_LINES = 3;

export function PlayerAdvancedChart({
  series,
  mode,
}: {
  series: AdvancedPoint[];
  mode: AdvancedSeriesMode;
}) {
  const { theme } = useTheme();
  const palette = getSeriesPalette({ theme });
  const [metrics, setMetrics] = useQueryState("adv", parseAsString);
  const [showDnp, setShowDnp] = useQueryState("dnp", parseAsBoolean.withDefault(false));
  const active = parseVisibleMetrics(metrics);

  const toggle = (key: AdvancedMetricKey) => {
    const next = active.includes(key)
      ? active.filter((activeKey) => activeKey !== key)
      : [...active, key];
    void setMetrics(next.join(","));
  };

  const hasActive = active.length > 0;
  const toggleAll = () => void setMetrics(hasActive ? "" : ADVANCED_METRIC_KEYS.join(","));

  // Colour is assigned by a metric's fixed slot within its panel, never by
  // its position among whichever chips happen to be on.
  const colorOf = (key: AdvancedMetricKey): string => {
    const panel = ADVANCED_PANELS.find((entry) => entry.keys.includes(key));
    const slot = panel?.keys.indexOf(key) ?? 0;
    return palette[slot % palette.length];
  };

  const panels = ADVANCED_PANELS.map((panel) => ({
    ...panel,
    metas: panel.keys
      .filter((key) => active.includes(key))
      .map((key): MetricMeta<AdvancedMetricKey> => ({
        key,
        label: advancedStatMeta(key)?.label ?? key,
        color: colorOf(key),
      })),
    isPercent: panel.keys.every((key) => advancedStatMeta(key)?.kind === "percentage"),
  })).filter((panel) => panel.metas.length > 0);

  return (
    <div className={styles.root}>
      <div className={styles.chips}>
        {ADVANCED_STAT_META.map((meta) => (
          <button
            key={meta.key}
            type="button"
            aria-pressed={active.includes(meta.key)}
            onClick={() => toggle(meta.key)}
            title={meta.fullName}
            className={styles.chip}
          >
            <span
              className={styles.swatch}
              style={{ backgroundColor: colorOf(meta.key) }}
              aria-hidden="true"
            />
            {meta.label}
          </button>
        ))}
        <button type="button" onClick={toggleAll} className={styles.chipAction}>
          {hasActive ? "Clear all" : "Select all"}
        </button>
      </div>

      <Switch
        label="Games missed"
        checked={showDnp}
        onChange={({ checked }) => void setShowDnp(checked)}
      />

      <p className={styles.caption}>{CAPTION_BY_MODE[mode]}</p>

      {panels.length === 0 ? (
        <p className={styles.emptyHint}>Select a metric to plot</p>
      ) : (
        <div className={styles.panels}>
          {panels.map((panel) => (
            <section key={panel.key} className={styles.panel}>
              <h3 className={styles.panelTitle}>{panel.title}</h3>
              <MetricLineChart
                metas={panel.metas}
                series={series}
                showDnp={showDnp}
                zeroLine={panel.key === "ratings"}
                endLabels={panel.metas.length <= MAX_LABELLED_LINES}
                formatValue={({ key, value }) => formatAdvancedStat({ key, value })}
                formatTick={panel.isPercent ? formatPercentTick : undefined}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
