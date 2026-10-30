"use client";

import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayloadEntry,
} from "recharts";

import { formatSigned } from "@vision/core/util/format";
import { AVERAGE_LINE_LABEL, AVERAGE_LINE_STYLE } from "@/lib/charts/averageLine";
import { fittedDomain } from "@/lib/charts/trendMethods";
import { CHART_CHROME, chartAxisProps } from "@vision/ui/charts/palette";
import { endLabel, lastPlottedIndex } from "@/components/ChartEndLabel/ChartEndLabel";
import { ListTooltip } from "@/components/ListTooltip/ListTooltip";
import { AVERAGE_KEY, type ChartRow } from "@/components/WatchlistTrendChart/WatchlistTrendChart";
import { usePrefersReducedMotion } from "@vision/ui/hooks/usePrefersReducedMotion";

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
  // Draws each row's league average as a dotted line.
  showAverage: boolean;
};

const formatDate = (value: number): string =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatValue = (value: number): string => formatSigned({ value, digits: 1 });

type ChartTooltipProps = {
  active?: boolean;
  label?: number;
  payload?: readonly TooltipPayloadEntry[];
};

function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || payload === undefined || payload.length === 0) return null;
  return (
    <ListTooltip
      title={label === undefined ? "" : formatDate(label)}
      entries={payload.map((entry) => ({
        key: String(entry.name),
        name: String(entry.name ?? ""),
        color: entry.color,
        value: typeof entry.value === "number" ? formatValue(entry.value) : "—",
      }))}
    />
  );
}

// The recharts half of WatchlistTrendChart, loaded client-only so the chart
// library stays off the home page's critical path. It fills the plot box its
// parent sizes, the same box the loading placeholder holds.
export function WatchlistTrendPlot({ rows, lines, showAverage }: WatchlistTrendPlotProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  // Fitted to the lines (and the average, when shown) so a jump in form
  // fills the plot instead of hugging a line padded out to zero.
  const domain = fittedDomain({
    values: rows.flatMap((row) => [
      ...lines.map((line) => row[line.dataKey]),
      showAverage ? row[AVERAGE_KEY] : undefined,
    ]),
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 76, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={CHART_CHROME.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          {...chartAxisProps({ rule: "axis" })}
          dataKey="date"
          type="category"
          tickFormatter={formatDate}
          minTickGap={24}
          interval="preserveStartEnd"
        />
        <YAxis
          {...chartAxisProps({ rule: "axis" })}
          domain={domain}
          allowDataOverflow
          tickFormatter={formatValue}
          width={48}
        />
        {showAverage && (
          <Line
            dataKey={AVERAGE_KEY}
            name={AVERAGE_LINE_LABEL}
            type="linear"
            {...AVERAGE_LINE_STYLE}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            connectNulls
          />
        )}
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_CHROME.axis }} />
        {lines.map((line) => {
          // A player can miss the final dates; their name belongs beside
          // their own last point, not at the chart's right edge.
          const lastIndex = lastPlottedIndex({ rows, key: line.dataKey });
          return (
            <Line
              key={line.dataKey}
              dataKey={line.dataKey}
              name={line.name}
              // Straight segments: a smoothed curve rounds off the very jumps
              // these charts exist to show.
              type="linear"
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
                content={endLabel({
                  text: line.endLabel,
                  lastIndex,
                  fill: line.color,
                  baseline: "middle",
                })}
              />
            </Line>
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
