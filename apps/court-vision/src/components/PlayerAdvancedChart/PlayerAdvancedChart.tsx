"use client";

import {
  ADVANCED_STAT_META,
  advancedStatMeta,
  formatAdvancedStat,
} from "@/lib/players/advancedStatMeta";
import { ADVANCED_METRIC_KEYS, type AdvancedMetricKey } from "@/lib/players/searchParams";
import type { AdvancedPoint, AdvancedSeriesMode } from "@/lib/stats/advancedSeries";
import { useTheme } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { MetricLineChart, type MetricMeta } from "@/components/MetricLineChart/MetricLineChart";
import { ChartPanel } from "@/components/SeriesChart/ChartPanel";
import { GamesMissedSwitch, useShowDnp } from "@/components/SeriesChart/GamesMissedSwitch";
import { SeriesChips } from "@/components/SeriesChart/SeriesChips";
import { useSeriesSelection } from "@/components/SeriesChart/useSeriesSelection";
import { getSeriesPalette } from "@vision/ui/charts/palette";

import { ADVANCED_PANELS } from "@/components/PlayerAdvancedChart/advancedChartMeta";
import styles from "@/components/PlayerAdvancedChart/PlayerAdvancedChart.module.scss";
import chartStyles from "@/components/SeriesChart/SeriesChart.module.scss";

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

type PlayerAdvancedChartProps = {
  series: AdvancedPoint[];
  mode: AdvancedSeriesMode;
};

export function PlayerAdvancedChart({ series, mode }: PlayerAdvancedChartProps) {
  const { theme } = useTheme();
  const palette = getSeriesPalette({ theme });
  const selection = useSeriesSelection({
    param: "adv",
    keys: ADVANCED_METRIC_KEYS,
    defaults: ADVANCED_METRIC_KEYS,
  });
  const { showDnp } = useShowDnp();

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
      .filter((key) => selection.isActive({ key }))
      .map((key): MetricMeta<AdvancedMetricKey> => ({
        key,
        label: advancedStatMeta({ key }).label,
        color: colorOf(key),
      })),
    isPercent: panel.keys.every((key) => advancedStatMeta({ key }).kind === "percentage"),
  })).filter((panel) => panel.metas.length > 0);

  return (
    <div className={chartStyles.root}>
      <SeriesChips
        selection={selection}
        all={ADVANCED_METRIC_KEYS}
        chips={ADVANCED_STAT_META.map((meta) => ({
          key: meta.key,
          label: meta.label,
          title: meta.fullName,
          mark: (
            <span
              className={styles.swatch}
              style={{ backgroundColor: colorOf(meta.key) }}
              aria-hidden="true"
            />
          ),
        }))}
      />

      <GamesMissedSwitch />

      <p className={styles.caption}>{CAPTION_BY_MODE[mode]}</p>

      {panels.length === 0 ? (
        <p className={chartStyles.emptyHint}>Select a metric to plot</p>
      ) : (
        <div className={styles.panels}>
          {panels.map((panel) => (
            <ChartPanel key={panel.key} title={panel.title}>
              <MetricLineChart
                metas={panel.metas}
                series={series}
                showDnp={showDnp}
                zeroLine={panel.key === "ratings"}
                endLabels={panel.metas.length <= MAX_LABELLED_LINES}
                formatValue={({ key, value }) => formatAdvancedStat({ key, value })}
                formatTick={panel.isPercent ? formatPercentTick : undefined}
              />
            </ChartPanel>
          ))}
        </div>
      )}
    </div>
  );
}
