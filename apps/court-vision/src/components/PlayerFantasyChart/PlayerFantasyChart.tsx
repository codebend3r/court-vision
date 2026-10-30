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
import { MetricLineChart, type MetricMeta } from "@/components/MetricLineChart/MetricLineChart";
import { BreakdownTooltip, SignedBar } from "@/components/PlayerFantasyChart/breakdownChart";
import {
  METHOD_KEYS,
  METHOD_LABELS,
  methodColors,
  type MethodKey,
  VALUE_LABELS,
  valueColors,
} from "@/components/PlayerFantasyChart/labels";
import { AVERAGE_LINE_LABEL, AVERAGE_LINE_STYLE } from "@/lib/charts/averageLine";
import { TrendChartControls } from "@/components/TrendChartControls/TrendChartControls";
import { useTrendChartPrefs } from "@/components/TrendChartControls/useTrendChartPrefs";
import { fittedDomain, visibleMethods } from "@/lib/charts/trendMethods";
import { type DatedMethodValues } from "@vision/core/valuation/leagueAverage";
import { type MethodValueKey } from "@vision/core/valuation/types";
import { ChartPanel } from "@/components/SeriesChart/ChartPanel";
import { GamesMissedSwitch, useShowDnp } from "@/components/SeriesChart/GamesMissedSwitch";
import { CHART_CHROME } from "@vision/ui/charts/palette";

import styles from "@/components/PlayerFantasyChart/PlayerFantasyChart.module.scss";
import chartStyles from "@/components/SeriesChart/SeriesChart.module.scss";

export type PlayerFantasyChartProps = {
  breakdown: FantasyCategoryBreakdown[];
  trend: FantasyTrendPoint[];
  // The league's average on every method per game date, for the moving
  // league-average line.
  averages: readonly DatedMethodValues[];
};

// The league's average on each game date, drawn dotted under a method's line.
const AVERAGE_META: MetricMeta<"average"> = {
  key: "average",
  label: AVERAGE_LINE_LABEL,
  color: AVERAGE_LINE_STYLE.stroke,
  dashed: true,
};

// Recharts hands its tick formatter the bare value.
const formatTick = (value: number): string => formatSigned({ value, digits: 1 });

// The fantasy view's two figures: where the value comes from (each category's
// Z and G, side by side) and where it is going (the rolling ten-game value
// across the timeframe). Both use the same two series colours, named once in
// the legend above.
export function PlayerFantasyChart({ breakdown, trend, averages }: PlayerFantasyChartProps) {
  const { theme } = useTheme();
  const colors = methodColors({ theme });
  const { showDnp } = useShowDnp();
  const { hidden, showAverage } = useTrendChartPrefs();
  const lineColors = valueColors({ theme });
  const keys = visibleMethods({ hidden });
  const averageByDate = new Map(averages.map(({ date, values }) => [date, values]));
  // No line at all when hidden or before the league has a reading.
  const drawsAverage = showAverage && averageByDate.size > 0;

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
          <TrendChartControls />
          {hasTrend ? (
            <ul className={styles.multiples} aria-label="Rolling value by method">
              {keys.map((key) => {
                // Each game joined to the league's average on its date.
                const series = trend.map((point) => ({
                  ...point,
                  average: drawsAverage
                    ? (averageByDate.get(Date.parse(point.gameDate))?.[key] ?? null)
                    : null,
                }));
                const metas: MetricMeta<MethodValueKey | "average">[] = [
                  { key, label: VALUE_LABELS[key], color: lineColors[key] },
                  ...(drawsAverage ? [AVERAGE_META] : []),
                ];
                return (
                  <li key={key} className={styles.multiple}>
                    <h4 className={styles.multipleTitle}>{VALUE_LABELS[key]}</h4>
                    <MetricLineChart
                      metas={metas}
                      series={series}
                      showDnp={showDnp}
                      // Fitted to this method's line (and its average), so a
                      // jump fills the box instead of hugging a scale padded
                      // out to zero.
                      domain={fittedDomain({
                        values: series.flatMap((point) => [point[key], point.average]),
                      })}
                      clipToDomain
                      curve="linear"
                      endLabels={false}
                      height={140}
                      formatValue={({ value }) => formatSigned({ value, digits: 1 })}
                      formatTick={formatTick}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={chartStyles.emptyHint}>
              No games in this timeframe to draw a rolling value from.
            </p>
          )}
        </ChartPanel>
      </div>
    </div>
  );
}
