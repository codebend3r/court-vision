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

import { isMetricPoint, type MetricPoint } from "@/lib/stats/metricPoint";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { getChartChrome } from "@/components/PlayerStatChart/statMeta";
import { TeamMatchup } from "@/components/TeamMatchup/TeamMatchup";

import styles from "@/components/MetricLineChart/MetricLineChart.module.scss";

export type MetricMeta<K extends string> = {
  key: K;
  label: string;
  color: string;
};

export type MetricSeriesPoint<K extends string> = MetricPoint & Record<K, number | null>;

export type MetricLineChartProps<K extends string> = {
  metas: readonly MetricMeta<K>[];
  series: readonly MetricSeriesPoint<K>[];
  formatValue: (args: { key: K; value: number }) => string;
  formatTick?: (value: number) => string;
  domain?: [number, number];
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

// `gameDate` is stored as a UTC-midnight ISO string. Formatting it in the
// viewer's local timezone can shift the displayed date back a day for any
// timezone west of UTC, so the date is always rendered in UTC.
const formatDate = (isoDate: string): string =>
  new Date(isoDate).toLocaleDateString(undefined, { timeZone: "UTC" });

function DnpMarker({
  viewBox,
}: {
  viewBox?: { x?: number; y?: number; height?: number };
}): ReactElement | null {
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

const renderEndLabel = ({
  label,
  lastIndex,
  fill,
}: {
  label: string;
  lastIndex: number;
  fill: string;
}) =>
  function EndLabel(props: {
    x?: number | string;
    y?: number | string;
    index?: number;
  }): ReactElement | null {
    const { x, y, index } = props;
    if (index !== lastIndex || typeof x !== "number" || typeof y !== "number") {
      return null;
    }
    return (
      <text x={x + 8} y={y + 4} fill={fill} fontSize={12}>
        {label}
      </text>
    );
  };

// Recharts clones `content` (see ContentType in its Tooltip types) and injects
// `active`/`payload` at render time — they are never supplied at JSX-authoring
// time here, so they must stay optional on this component's own prop type.
type MetricTooltipProps<K extends string> = {
  active?: boolean;
  payload?: TooltipPayload;
  metas: readonly MetricMeta<K>[];
  series: readonly MetricSeriesPoint<K>[];
  formatValue: (args: { key: K; value: number }) => string;
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
    <div className={styles.tooltip}>
      <p className={styles.tooltipHeader}>
        Game {point.gameIndex} · {formatDate(point.gameDate)} ·{" "}
        <TeamMatchup matchup={point.matchup} size="sm" /> {point.winLoss ?? ""}
      </p>
      {metas.map((meta) => {
        const value = point[meta.key];
        return (
          <p key={meta.key} className={styles.tooltipRow}>
            <span className={styles.dot} style={{ backgroundColor: meta.color }} />
            {meta.label}: {value === null ? "—" : formatValue({ key: meta.key, value })}
          </p>
        );
      })}
      {point.dnp && <p className={styles.tooltipStatus}>DNP / DNP-CD (0 MIN)</p>}
    </div>
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
  showDnp = false,
  zeroLine = false,
  endLabels = true,
  height = 320,
}: MetricLineChartProps<K>) {
  const { theme } = useTheme();
  const chrome = getChartChrome({ theme });

  // A line ends at its last recorded game, which a run of trailing DNPs or
  // missing rows can put well before the final x tick; the label belongs
  // beside that point, not floating where the line would have gone.
  const lastIndexOf = (key: K): number =>
    series.reduce((last, point, index) => (point[key] === null ? last : index), -1);

  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 800, height }}>
      <LineChart data={[...series]} margin={{ top: 8, right: 56, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={chrome.grid} vertical={false} />
        <XAxis
          dataKey="gameIndex"
          interval="equidistantPreserveStart"
          tick={{ fill: chrome.axis, fontSize: 12 }}
          stroke={chrome.grid}
        />
        <YAxis
          tick={{ fill: chrome.axis, fontSize: 12 }}
          stroke={chrome.grid}
          domain={domain}
          tickFormatter={formatTick}
        />
        <Tooltip
          content={<MetricTooltip metas={metas} series={series} formatValue={formatValue} />}
          cursor={{ stroke: chrome.axis, strokeDasharray: "3 3" }}
        />
        {zeroLine && <ReferenceLine y={0} stroke={chrome.axis} />}
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
            type="monotone"
            dataKey={meta.key}
            stroke={meta.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
            connectNulls={false}
            label={
              endLabels
                ? renderEndLabel({
                    label: meta.label,
                    lastIndex: lastIndexOf(meta.key),
                    fill: chrome.endLabel,
                  })
                : undefined
            }
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
