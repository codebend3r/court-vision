"use client";

import { type ReactElement } from "react";
import {
  CartesianGrid,
  DefaultZIndexes,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayload,
} from "recharts";

import { isMetricPoint, type MetricPoint } from "@vision/core/series/metricPoint";
import { AVERAGE_LINE_STYLE } from "@/lib/charts/averageLine";
import { CHART_CHROME, chartAxisProps } from "@vision/ui/charts/palette";
import { endLabel, lastPlottedIndex } from "@/components/ChartEndLabel/ChartEndLabel";
import { SeriesTooltip } from "@/components/SeriesTooltip/SeriesTooltip";
import { TeamMatchup } from "@/components/TeamMatchup/TeamMatchup";

import styles from "@/components/MetricLineChart/MetricLineChart.module.scss";

export type MetricMeta<K extends string> = {
  key: K;
  label: string;
  color: string;
  // A reference series (a league average, say) draws dotted.
  dashed?: boolean;
};

export type MetricSeriesPoint<K extends string> = MetricPoint & Record<K, number | null>;

type FormatValueProps<K extends string> = { key: K; value: number };

export type MetricLineChartProps<K extends string> = {
  metas: readonly MetricMeta<K>[];
  series: readonly MetricSeriesPoint<K>[];
  formatValue: (args: FormatValueProps<K>) => string;
  formatTick?: (value: number) => string;
  domain?: [number, number];
  // Holds the axis to `domain` even when a value falls outside it. Only the
  // fitted rolling charts want this; a fixed scale (0–100%) may stretch.
  clipToDomain?: boolean;
  showDnp?: boolean;
  // Draws the zero line solid: for signed series (net rating, value over
  // average) it is the reading, not just a gridline.
  zeroLine?: boolean;
  // Names each line beside its last point. A panel dense enough for the
  // labels to collide turns them off and lets its legend and tooltip carry
  // identity instead.
  endLabels?: boolean;
  height?: number;
  // Straight segments show a jump as sharply as it happened; the smoothed
  // default suits the box-score panels.
  curve?: "monotone" | "linear";
};

// `gameDate` is stored as a UTC-midnight ISO string. Formatting it in the
// viewer's local timezone can shift the displayed date back a day for any
// timezone west of UTC, so the date is always rendered in UTC.
const formatDate = (isoDate: string): string =>
  new Date(isoDate).toLocaleDateString(undefined, { timeZone: "UTC" });

type DnpMarkerProps = {
  viewBox?: { x?: number; y?: number; height?: number };
};

function DnpMarker({ viewBox }: DnpMarkerProps): ReactElement | null {
  const { x, y, height } = viewBox ?? {};
  if (typeof x !== "number" || typeof y !== "number" || typeof height !== "number") {
    return null;
  }

  return (
    <circle
      data-dnp-marker
      aria-hidden="true"
      className={styles.dnpMarker}
      cx={x}
      cy={y + height}
      r={4}
    />
  );
}

// Recharts clones `content` (see ContentType in its Tooltip types) and injects
// `active`/`payload` at render time — they are never supplied at JSX-authoring
// time here, so they must stay optional on this component's own prop type.
type MetricTooltipProps<K extends string> = {
  active?: boolean;
  payload?: TooltipPayload;
  metas: readonly MetricMeta<K>[];
  series: readonly MetricSeriesPoint<K>[];
  formatValue: (args: FormatValueProps<K>) => string;
};

function MetricTooltip<K extends string>({
  active,
  payload,
  metas,
  series,
  formatValue,
}: MetricTooltipProps<K>): ReactElement | null {
  if (!active || !payload || !payload.length) {
    return null;
  }

  // The hovered payload is untyped; the typed point is looked up by its game
  // index so every metric read below is a real key of the series.
  const hovered: unknown = payload[0].payload;
  if (!isMetricPoint(hovered)) {
    return null;
  }
  const point = series.find((entry) => entry.gameIndex === hovered.gameIndex);
  if (point === undefined) {
    return null;
  }

  return (
    <SeriesTooltip
      header={
        <>
          Game {point.gameIndex} · {formatDate(point.gameDate)} ·{" "}
          <TeamMatchup matchup={point.matchup} size="sm" /> {point.winLoss ?? ""}
        </>
      }
      rows={metas.map((meta) => {
        const value = point[meta.key];
        return {
          key: meta.key,
          label: meta.label,
          color: meta.color,
          value: value === null ? "—" : formatValue({ key: meta.key, value }),
        };
      })}
      status={point.dnp ? "DNP / DNP-CD (0 MIN)" : undefined}
    />
  );
}

// One per-game line chart for any set of metrics that share a scale: the
// regular box-score panels, the advanced-metric panels, and the fantasy value
// trend all render through it, so the axes, tooltip, end labels, and missed-
// game markers read the same on every view.
export function MetricLineChart<K extends string>({
  metas,
  series,
  formatValue,
  formatTick,
  domain,
  clipToDomain = false,
  showDnp = false,
  zeroLine = false,
  endLabels = true,
  height = 320,
  curve = "monotone",
}: MetricLineChartProps<K>) {
  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 800, height }}>
      <LineChart data={[...series]} margin={{ top: 8, right: 56, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
        <XAxis
          {...chartAxisProps({ rule: "grid" })}
          dataKey="gameIndex"
          interval="equidistantPreserveStart"
        />
        <YAxis
          {...chartAxisProps({ rule: "grid" })}
          domain={domain}
          allowDataOverflow={clipToDomain}
          tickFormatter={formatTick}
        />
        <Tooltip
          content={<MetricTooltip metas={metas} series={series} formatValue={formatValue} />}
          cursor={{ stroke: CHART_CHROME.axis, strokeDasharray: "3 3" }}
        />
        {zeroLine && <ReferenceLine y={0} stroke={CHART_CHROME.axis} />}
        {showDnp &&
          series
            .filter((point) => point.dnp)
            .map((point) => (
              <ReferenceLine
                key={point.gameIndex}
                x={point.gameIndex}
                stroke="none"
                label={<DnpMarker />}
                // Lift the marker above the data lines (default z-index 400) so
                // it is never painted over; the dot belongs on the scatter layer.
                zIndex={DefaultZIndexes.scatter}
              />
            ))}
        {metas.map((meta) => (
          <Line
            key={meta.key}
            type={curve}
            dataKey={meta.key}
            stroke={meta.color}
            strokeWidth={meta.dashed ? AVERAGE_LINE_STYLE.strokeWidth : 2}
            strokeDasharray={meta.dashed ? AVERAGE_LINE_STYLE.strokeDasharray : undefined}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
            connectNulls={false}
            // A line ends at its last recorded game, which a run of trailing
            // DNPs or missing rows can put well before the final x tick; the
            // label belongs beside that point, not where the line would have gone.
            label={
              endLabels
                ? endLabel({
                    text: meta.label,
                    lastIndex: lastPlottedIndex({ rows: series, key: meta.key }),
                    fill: CHART_CHROME.axis,
                  })
                : undefined
            }
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
