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
} from "recharts";

import { isMetricPoint, type MetricPoint } from "@vision/core/series/metricPoint";
import {
  CHART_CHROME,
  chartAxisProps,
  chartLineProps,
  chartReferenceLineProps,
} from "@vision/ui/charts/palette";
import { endLabel, lastPlottedIndex } from "@/components/ChartEndLabel/ChartEndLabel";
import {
  DNP_STATUS,
  formatGameDate,
  hoveredRow,
  SeriesTooltip,
  type InjectedTooltipProps,
} from "@/components/SeriesTooltip/SeriesTooltip";
import { TeamMatchup } from "@/components/TeamMatchup/TeamMatchup";

import styles from "@/components/MetricLineChart/MetricLineChart.module.scss";

export type MetricMeta<K extends string> = {
  key: K;
  label: string;
  color: string;
  // A reference series (a league average, say): drawn as the shared dotted
  // reference line, behind the data rather than as one more series.
  reference?: boolean;
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
};

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

type MetricTooltipProps<K extends string> = InjectedTooltipProps & {
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
  // The hovered payload is untyped; the typed point is looked up by its game
  // index so every metric read below is a real key of the series.
  const hovered = hoveredRow({ active, payload });
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
          Game {point.gameIndex} · {formatGameDate(point.gameDate)} ·{" "}
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
      status={point.dnp ? DNP_STATUS : undefined}
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
}: MetricLineChartProps<K>) {
  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 800, height }}>
      <LineChart data={[...series]} margin={{ top: 8, right: 56, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={CHART_CHROME.grid} strokeDasharray="3 3" vertical={false} />
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
            {...(meta.reference
              ? chartReferenceLineProps()
              : {
                  ...chartLineProps({ color: meta.color }),
                  isAnimationActive: false,
                  connectNulls: false,
                })}
            dataKey={meta.key}
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
