"use client";

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
import { formatSigned } from "@vision/core/util/format";
import { type FantasyTrendPoint } from "@vision/core/valuation/playerValue";
import { ROLLING_WINDOW_GAMES } from "@vision/core/valuation/rolling";
import { MetricLineChart, type MetricMeta } from "@/components/MetricLineChart/MetricLineChart";
import { BreakdownTooltip, SignedBar } from "@/components/PlayerFantasyChart/breakdownChart";
import {
  METHOD_KEYS,
  METHOD_LABELS,
  methodColors,
  type MethodKey,
} from "@/components/PlayerFantasyChart/labels";
import { ChartPanel } from "@/components/SeriesChart/ChartPanel";
import { GamesMissedSwitch, useShowDnp } from "@/components/SeriesChart/GamesMissedSwitch";
import { CHART_CHROME } from "@vision/ui/charts/palette";

import styles from "@/components/PlayerFantasyChart/PlayerFantasyChart.module.scss";
import chartStyles from "@/components/SeriesChart/SeriesChart.module.scss";

export type PlayerFantasyChartProps = {
  breakdown: FantasyCategoryBreakdown[];
  trend: FantasyTrendPoint[];
};

// Recharts hands its tick formatter the bare value.
const formatTick = (value: number): string => formatSigned({ value, digits: 1 });

// The fantasy view's two figures: where the value comes from (each category's
// Z and G, side by side) and where it is going (the rolling ten-game value
// across the timeframe). Both use the same two series colours, named once in
// the legend above.
export function PlayerFantasyChart({ breakdown, trend }: PlayerFantasyChartProps) {
  const { theme } = useTheme();
  const colors = methodColors({ theme });
  const { showDnp } = useShowDnp();

  const trendMetas: MetricMeta<MethodKey>[] = METHOD_KEYS.map((key) => ({
    key,
    label: METHOD_LABELS[key],
    color: colors[key],
  }));
  const hasTrend = trend.some((point) => point.z !== null || point.g !== null);

  return (
    <div className={chartStyles.root}>
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

      <GamesMissedSwitch />

      <div className={styles.panels}>
        <ChartPanel title="Category breakdown">
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
              <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: CHART_CHROME.axis, fontSize: 12 }}
                stroke={CHART_CHROME.grid}
              />
              <YAxis
                tick={{ fill: CHART_CHROME.axis, fontSize: 12 }}
                stroke={CHART_CHROME.grid}
                tickFormatter={formatTick}
              />
              <Tooltip
                content={<BreakdownTooltip breakdown={breakdown} colors={colors} />}
                cursor={{ fill: CHART_CHROME.grid, fillOpacity: 0.35 }}
              />
              <ReferenceLine y={0} stroke={CHART_CHROME.axis} />
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
        </ChartPanel>

        <ChartPanel title="Rolling value">
          {hasTrend ? (
            <MetricLineChart
              metas={trendMetas}
              series={trend}
              showDnp={showDnp}
              zeroLine
              formatValue={({ value }) => formatSigned({ value, digits: 1 })}
              formatTick={formatTick}
            />
          ) : (
            <p className={chartStyles.emptyHint}>
              Rolling value needs {ROLLING_WINDOW_GAMES} games in this timeframe before it can be
              drawn.
            </p>
          )}
        </ChartPanel>
      </div>
    </div>
  );
}
