"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SeriesTooltip } from "@/components/SeriesTooltip/SeriesTooltip";
import { CHART_CHROME, chartAxisProps } from "@vision/ui/charts/palette";
import { CHART_PADDING, plotHeight } from "@/components/RosterStatCharts/plotSize";
import { type BarDatum, type Tier } from "@/lib/roster/compare";

// Fill by tier, from the theme's own tokens so the chart re-inks with the
// theme: win and loss are the two colours every theme already keeps apart for
// colour-blind readers. Rank never rests on colour: bars run best first and
// every one carries its value.
export const TIER_COLORS: Record<Tier, string> = {
  strong: "var(--color-win)",
  average: "var(--color-text-muted)",
  weak: "var(--color-loss)",
  neutral: "var(--color-accent)",
};

export const TIER_LABELS: Record<Tier, string> = {
  strong: "Top third of the league",
  average: "Middle third of the league",
  weak: "Bottom third of the league",
  neutral: "Describes a role, not quality",
};

const NAME_WIDTH = 84;

export type RosterBarPlotProps = {
  label: string;
  bars: readonly BarDatum[];
};

const ordinal = ({ value }: { value: number }): string => {
  const whole = Math.round(value);
  const lastTwo = whole % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${whole}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[whole % 10] ?? "th";
  return `${whole}${suffix}`;
};

type TipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: BarDatum }>;
  label: string;
};

function BarTip({ active, payload, label }: TipProps) {
  const bar = payload?.[0]?.payload;
  if (!active || bar === undefined) return null;
  return (
    <SeriesTooltip
      header={bar.fullName}
      rows={[
        { key: "value", label, color: TIER_COLORS[bar.tier], value: bar.label },
        {
          key: "percentile",
          label: "League percentile",
          color: TIER_COLORS[bar.tier],
          value: ordinal({ value: bar.percentile }),
        },
      ]}
      status={TIER_LABELS[bar.tier]}
    />
  );
}

// One stat, every rostered player a horizontal bar, best first. Bars share the
// zero line so a negative rating reads as a bar the other way.
export function RosterBarPlot({ label, bars }: RosterBarPlotProps) {
  const height = plotHeight({ count: bars.length });
  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 320, height }}>
      <BarChart
        data={[...bars]}
        layout="vertical"
        margin={{ top: CHART_PADDING, right: 44, bottom: CHART_PADDING, left: 0 }}
        barCategoryGap={4}
        // Every chart would be a tab stop; the figure's text reading carries it.
        accessibilityLayer={false}
      >
        <XAxis
          type="number"
          hide
          domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={NAME_WIDTH}
          tickLine={false}
          interval={0}
          {...chartAxisProps({ rule: "grid" })}
        />
        <Tooltip
          content={({ active, payload }) => (
            <BarTip active={active} payload={payload} label={label} />
          )}
          cursor={{ fill: CHART_CHROME.grid, fillOpacity: 0.35 }}
          allowEscapeViewBox={{ x: false, y: true }}
          wrapperStyle={{ zIndex: 30 }}
        />
        <Bar dataKey="value" isAnimationActive={false} radius={[0, 2, 2, 0]} minPointSize={2}>
          {bars.map((bar) => (
            <Cell key={bar.id} fill={TIER_COLORS[bar.tier]} />
          ))}
          <LabelList
            dataKey="label"
            position="right"
            fill={CHART_CHROME.axis}
            fontSize={12}
            offset={6}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
