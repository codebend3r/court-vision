"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayloadEntry,
} from "recharts";

import { CHART_CHROME, chartAxisProps } from "@vision/ui/charts/palette";
import { ListTooltip } from "@/components/ListTooltip/ListTooltip";
import { usePrefersReducedMotion } from "@vision/ui/hooks/usePrefersReducedMotion";
import { useTheme, type Theme } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { THEME_META } from "@vision/ui/theme/themes";
import { contrastRatio } from "@/lib/teams/color";
import { teamColorsFor, type TeamAbbreviation } from "@/lib/teams/meta";
import { type WinsRow } from "@vision/core/series/teamTrend";

export type StandingsTrendPlotProps = {
  teams: ReadonlyArray<{ abbr: TeamAbbreviation; name: string }>;
  rows: readonly WinsRow[];
  // The team the legend has pinned or a pointer is over; every other line dims.
  active: TeamAbbreviation | null;
  onHover: (args: { abbr: TeamAbbreviation | null }) => void;
};

// The extreme each background tone sits near. Judging a line against it rather
// than a theme's exact surface keeps every dark theme (high contrast's pure
// black included) on one rule.
const BACKDROP_BY_TONE = { dark: "#000000", light: "#FFFFFF" } as const;

// Below this a primary is all but the backdrop's own color. It only catches
// the near-black and near-white primaries (BKN), never a merely dark navy.
const MIN_LINE_CONTRAST = 1.2;

// Team primary color, swapping to secondary when the primary would vanish
// against the theme's background tone (BKN's black line on any dark theme).
export const lineColorFor = ({ abbr, theme }: { abbr: TeamAbbreviation; theme: Theme }): string => {
  const team = teamColorsFor({ team: abbr });
  if (team === null) return "#888888";
  const tone = THEME_META.find((meta) => meta.id === theme)?.tone ?? "dark";
  return contrastRatio({ a: team.primary, b: BACKDROP_BY_TONE[tone] }) < MIN_LINE_CONTRAST
    ? team.secondary
    : team.primary;
};

const MAX_TOOLTIP_ROWS = 6;

type ChartTooltipProps = {
  highlighted: TeamAbbreviation | null;
  active?: boolean;
  label?: number;
  payload?: readonly TooltipPayloadEntry[];
};

function ChartTooltip({ highlighted, active, label, payload }: ChartTooltipProps) {
  if (!active || payload === undefined || payload.length === 0) return null;

  const highlightedEntries =
    highlighted === null ? [] : payload.filter((entry) => entry.dataKey === highlighted);
  const sorted =
    highlightedEntries.length > 0
      ? highlightedEntries
      : [...payload].sort((a, b) => {
          const aValue = typeof a.value === "number" ? a.value : -Infinity;
          const bValue = typeof b.value === "number" ? b.value : -Infinity;
          return bValue - aValue;
        });
  const visible = highlightedEntries.length > 0 ? sorted : sorted.slice(0, MAX_TOOLTIP_ROWS);
  const remaining = sorted.length - visible.length;

  return (
    <ListTooltip
      title={`Game ${label ?? ""}`}
      entries={visible.map((entry) => ({
        key: String(entry.name),
        name: String(entry.name ?? ""),
        color: entry.color,
        value: typeof entry.value === "number" ? String(entry.value) : "—",
      }))}
      more={remaining}
    />
  );
}

// The recharts half of StandingsTrendChart, loaded client-only so the chart
// library stays off /teams' critical path. It fills the plot box its parent
// sizes, the same box the loading placeholder holds.
export function StandingsTrendPlot({ teams, rows, active, onHover }: StandingsTrendPlotProps) {
  const { theme } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={[...rows]} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={CHART_CHROME.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          {...chartAxisProps({ rule: "axis" })}
          dataKey="game"
          type="number"
          domain={[1, "dataMax"]}
          allowDecimals={false}
          minTickGap={24}
        />
        <YAxis {...chartAxisProps({ rule: "axis" })} allowDecimals={false} width={32} />
        <Tooltip
          content={<ChartTooltip highlighted={active} />}
          cursor={{ stroke: CHART_CHROME.axis }}
        />
        {teams.map((team) => {
          const color = lineColorFor({ abbr: team.abbr, theme });
          const emphasized = active === null || active === team.abbr;
          return (
            <Line
              key={team.abbr}
              dataKey={team.abbr}
              name={team.name}
              type="monotone"
              stroke={color}
              strokeWidth={active === team.abbr ? 3 : 1.5}
              strokeOpacity={emphasized ? 1 : 0.18}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={!prefersReducedMotion}
              connectNulls
              onMouseEnter={() => onHover({ abbr: team.abbr })}
              onMouseLeave={() => onHover({ abbr: null })}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
