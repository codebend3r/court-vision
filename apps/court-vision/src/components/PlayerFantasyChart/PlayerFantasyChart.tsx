"use client";

import { parseAsBoolean, useQueryState } from "nuqs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTheme } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";
import { type FantasyTrendPoint } from "@vision/core/valuation/playerValue";
import { ROLLING_WINDOW_GAMES } from "@vision/core/valuation/rolling";
import { MetricLineChart, type MetricMeta } from "@/components/MetricLineChart/MetricLineChart";
import { BreakdownTooltip, SignedBar } from "@/components/PlayerFantasyChart/breakdownChart";
import {
  formatSigned,
  METHOD_LABELS,
  type MethodKey,
} from "@/components/PlayerFantasyChart/labels";
import { getChartChrome, getSeriesPalette } from "@vision/ui/charts/palette";
import { Switch } from "@vision/ui/components/Switch/Switch";

import styles from "@/components/PlayerFantasyChart/PlayerFantasyChart.module.scss";

export type PlayerFantasyChartProps = {
  breakdown: FantasyCategoryBreakdown[];
  trend: FantasyTrendPoint[];
};

// The fantasy view's two figures: where the value comes from (each category's
// Z and G, side by side) and where it is going (the rolling ten-game value
// across the timeframe). Both use the same two series colours, named once in
// the legend above.
export function PlayerFantasyChart({ breakdown, trend }: PlayerFantasyChartProps) {
  const { theme } = useTheme();
  const chrome = getChartChrome({ theme });
  const palette = getSeriesPalette({ theme });
  const colors: Record<MethodKey, string> = { z: palette[0], g: palette[1] };
  const [showDnp, setShowDnp] = useQueryState("dnp", parseAsBoolean.withDefault(false));

  const trendMetas: MetricMeta<MethodKey>[] = [
    { key: "z", label: METHOD_LABELS.z, color: colors.z },
    { key: "g", label: METHOD_LABELS.g, color: colors.g },
  ];
  const hasTrend = trend.some((point) => point.z !== null || point.g !== null);

  return (
    <div className={styles.root}>
      <ul className={styles.legend} aria-label="Series">
        {trendMetas.map((meta) => (
          <li key={meta.key} className={styles.legendItem}>
            <span
              className={styles.swatch}
              style={{ backgroundColor: meta.color }}
              aria-hidden="true"
            />
            {meta.label}
          </li>
        ))}
      </ul>

      <Switch
        label="Games missed"
        checked={showDnp}
        onChange={({ checked }) => void setShowDnp(checked)}
      />

      <div className={styles.panels}>
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Category breakdown</h3>
          <ResponsiveContainer
            width="100%"
            height={320}
            initialDimension={{ width: 800, height: 320 }}
          >
            <BarChart
              data={breakdown}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
              barGap={2}
              maxBarSize={24}
            >
              <CartesianGrid stroke={chrome.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: chrome.axis, fontSize: 12 }}
                stroke={chrome.grid}
              />
              <YAxis
                tick={{ fill: chrome.axis, fontSize: 12 }}
                stroke={chrome.grid}
                tickFormatter={formatSigned}
              />
              <Tooltip
                content={<BreakdownTooltip breakdown={breakdown} colors={colors} />}
                cursor={{ fill: chrome.grid, fillOpacity: 0.35 }}
              />
              <ReferenceLine y={0} stroke={chrome.axis} />
              {trendMetas.map((meta) => (
                <Bar
                  key={meta.key}
                  dataKey={meta.key}
                  name={meta.label}
                  fill={meta.color}
                  shape={SignedBar}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Rolling value</h3>
          {hasTrend ? (
            <MetricLineChart
              metas={trendMetas}
              series={trend}
              showDnp={showDnp}
              zeroLine
              formatValue={({ value }) => formatSigned(value)}
              formatTick={formatSigned}
            />
          ) : (
            <p className={styles.emptyHint}>
              Rolling value needs {ROLLING_WINDOW_GAMES} games in this timeframe before it can be
              drawn.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
