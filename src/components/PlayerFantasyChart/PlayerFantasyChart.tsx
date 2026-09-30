"use client";

import { type ReactElement } from "react";
import { parseAsBoolean, useQueryState } from "nuqs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type RectangleProps,
  type TooltipPayload,
} from "recharts";

import { useTheme } from "@/lib/theme/ThemeProvider";
import type { FantasyCategoryBreakdown, FantasyTrendPoint } from "@/lib/valuation/playerValue";
import { ROLLING_WINDOW_GAMES } from "@/lib/watchlist/trend";
import { MetricLineChart, type MetricMeta } from "@/components/MetricLineChart/MetricLineChart";
import { getChartChrome, getSeriesPalette } from "@/components/PlayerStatChart/statMeta";
import { Switch } from "@/components/Switch/Switch";

import styles from "@/components/PlayerFantasyChart/PlayerFantasyChart.module.scss";

type MethodKey = "z" | "g";

const METHOD_LABELS: Record<MethodKey, string> = { z: "Z-Score", g: "G-Score" };

const formatSigned = (value: number): string =>
  value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);

// Per-game display beside a category's score: counting stats to one decimal,
// ratio categories as the make rate the Fantasy tab prints (".480").
const formatPerGame = (entry: FantasyCategoryBreakdown): string =>
  entry.kind === "ratio"
    ? entry.perGame.toFixed(3).replace(/^0(?=\.)/, "")
    : entry.perGame.toFixed(1);

// A bar's rounded end belongs at the data end. Recharts applies `radius` to
// the same rectangle corners whichever way the bar grows, so a negative bar
// needs its bottom corners rounded instead of its top.
function SignedBar(props: BarShapeProps): ReactElement {
  const value = Array.isArray(props.value) ? props.value[1] - props.value[0] : props.value;
  const radius: NonNullable<RectangleProps["radius"]> = value < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0];
  return (
    <Rectangle
      x={props.x}
      y={props.y}
      width={props.width}
      height={props.height}
      fill={props.fill}
      radius={radius}
    />
  );
}

type BreakdownTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload;
  breakdown: readonly FantasyCategoryBreakdown[];
  colors: Record<MethodKey, string>;
};

function BreakdownTooltip({
  active,
  payload,
  breakdown,
  colors,
}: BreakdownTooltipProps): ReactElement | null {
  if (!active || !payload || !payload.length) {
    return null;
  }
  const hovered: unknown = payload[0].payload;
  if (typeof hovered !== "object" || hovered === null || !("key" in hovered)) {
    return null;
  }
  const entry = breakdown.find((candidate) => candidate.key === hovered.key);
  if (entry === undefined) {
    return null;
  }

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipHeader}>
        {entry.fullName} · {formatPerGame(entry)} per game
      </p>
      <p className={styles.tooltipRow}>
        <span className={styles.dot} style={{ backgroundColor: colors.z }} />
        {METHOD_LABELS.z}: {formatSigned(entry.z)}
      </p>
      <p className={styles.tooltipRow}>
        <span className={styles.dot} style={{ backgroundColor: colors.g }} />
        {METHOD_LABELS.g}: {formatSigned(entry.g)}
      </p>
    </div>
  );
}

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
