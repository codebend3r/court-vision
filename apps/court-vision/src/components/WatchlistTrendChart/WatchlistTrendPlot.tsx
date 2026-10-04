"use client";

import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayloadEntry,
} from "recharts";

import { getChartChrome } from "@vision/ui/charts/palette";
import type { ChartRow } from "@/components/WatchlistTrendChart/WatchlistTrendChart";
import { usePrefersReducedMotion } from "@vision/ui/hooks/usePrefersReducedMotion";
import { useTheme } from "@vision/ui/components/ThemeProvider/ThemeProvider";

import styles from "@/components/WatchlistTrendChart/WatchlistTrendChart.module.scss";

// One plotted player, already resolved by the figure: which row field the
// line reads, what the tooltip and end label call it, and its series color.
export type WatchlistTrendLine = {
  dataKey: string;
  name: string;
  endLabel: string;
  color: string;
};

export type WatchlistTrendPlotProps = {
  rows: ChartRow[];
  lines: readonly WatchlistTrendLine[];
};

const formatDate = (value: number): string =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatValue = (value: number): string =>
  value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);

type ChartTooltipProps = {
  active?: boolean;
  label?: number;
  payload?: readonly TooltipPayloadEntry[];
};

function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || payload === undefined || payload.length === 0) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>{label === undefined ? "" : formatDate(label)}</p>
      <ul className={styles.tooltipList}>
        {payload.map((entry) => (
          <li key={String(entry.name)} className={styles.tooltipRow}>
            <span
              aria-hidden="true"
              className={styles.swatch}
              style={{ background: entry.color }}
            />
            <span>{entry.name}</span>
            <span className={styles.tooltipValue}>
              {typeof entry.value === "number" ? formatValue(entry.value) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Recharts hands label content the resolved position of every point; only the
// series' own final point gets a name drawn beside it.
type EndLabelRenderProps = { x?: number | string; y?: number | string; index?: number };

const endLabelRenderer = ({
  lastIndex,
  text,
  color,
}: {
  lastIndex: number;
  text: string;
  color: string;
}) => {
  // Named rather than a bare arrow: recharts renders this as a component, and
  // an anonymous one has no display name in the tree.
  function EndLabel(props: EndLabelRenderProps) {
    if (props.index !== lastIndex) return null;
    const x = Number(props.x);
    const y = Number(props.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return (
      <text x={x + 8} y={y} fill={color} fontSize={12} dominantBaseline="middle">
        {text}
      </text>
    );
  }
  return EndLabel;
};

// The recharts half of WatchlistTrendChart, loaded client-only so the chart
// library stays off the home page's critical path. It fills the plot box its
// parent sizes, the same box the loading placeholder holds.
export function WatchlistTrendPlot({ rows, lines }: WatchlistTrendPlotProps) {
  const { theme } = useTheme();
  const chrome = getChartChrome({ theme });
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 76, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={chrome.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          type="category"
          tickFormatter={formatDate}
          stroke={chrome.axis}
          tick={{ fill: chrome.axis, fontSize: 12 }}
          minTickGap={24}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke={chrome.axis}
          tick={{ fill: chrome.axis, fontSize: 12 }}
          tickFormatter={formatValue}
          width={48}
        />
        {/* Zero is league-average value: above it a player helps you. */}
        <ReferenceLine y={0} stroke={chrome.axis} strokeDasharray="4 4" />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: chrome.axis }} />
        {lines.map((line) => {
          // A player can miss the final dates; their name belongs beside
          // their own last point, not at the chart's right edge.
          const lastIndex = rows.reduce(
            (last, row, rowIndex) => (row[line.dataKey] === undefined ? last : rowIndex),
            -1,
          );
          return (
            <Line
              key={line.dataKey}
              dataKey={line.dataKey}
              name={line.name}
              type="monotone"
              stroke={line.color}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={!prefersReducedMotion}
              // A missed game date must not cut the line in half.
              connectNulls
            >
              <LabelList
                dataKey={line.dataKey}
                content={endLabelRenderer({ lastIndex, text: line.endLabel, color: line.color })}
              />
            </Line>
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
