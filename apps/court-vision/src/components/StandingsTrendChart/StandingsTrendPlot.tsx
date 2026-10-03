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

import { getChartChrome } from "@/components/PlayerStatChart/statMeta";
import { NBA_TEAMS, type TeamAbbreviation } from "@/components/TeamChip/TeamChip";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { useTheme, type Theme } from "@/lib/theme/ThemeProvider";
import { type WinsRow } from "@/lib/teams/trend";

import styles from "@/components/StandingsTrendChart/StandingsTrendChart.module.scss";

export type StandingsTrendPlotProps = {
  teams: ReadonlyArray<{ abbr: TeamAbbreviation; name: string }>;
  rows: readonly WinsRow[];
  // The team the legend has pinned or a pointer is over; every other line dims.
  active: TeamAbbreviation | null;
  onHover: (args: { abbr: TeamAbbreviation | null }) => void;
};

// Relative luminance of a #rrggbb hex, 0 (black) – 1 (white).
const luminance = (hex: string): number => {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number): number => ((value >> shift) & 0xff) / 255;
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
};

// Team primary color, swapping to secondary when the primary would vanish
// against the theme background (e.g. BKN's black line on the dark theme).
export const lineColorFor = ({ abbr, theme }: { abbr: TeamAbbreviation; theme: Theme }): string => {
  const team = NBA_TEAMS.find((entry) => entry.abbreviation === abbr);
  if (team === undefined) return "#888888";
  const primaryLum = luminance(team.primary);
  if (theme === "dark" && primaryLum < 0.08) return team.secondary;
  if (theme === "light" && primaryLum > 0.85) return team.secondary;
  return team.primary;
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
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>Game {label ?? ""}</p>
      <ul className={styles.tooltipList}>
        {visible.map((entry) => (
          <li key={String(entry.name)} className={styles.tooltipRow}>
            <span
              aria-hidden="true"
              className={styles.swatch}
              style={{ background: entry.color }}
            />
            <span>{entry.name}</span>
            <span className={styles.tooltipValue}>
              {typeof entry.value === "number" ? entry.value : "—"}
            </span>
          </li>
        ))}
        {!!remaining && <li className={styles.tooltipMore}>+{remaining} more</li>}
      </ul>
    </div>
  );
}

// The recharts half of StandingsTrendChart, loaded client-only so the chart
// library stays off /teams' critical path. It fills the plot box its parent
// sizes, the same box the loading placeholder holds.
export function StandingsTrendPlot({ teams, rows, active, onHover }: StandingsTrendPlotProps) {
  const { theme } = useTheme();
  const chrome = getChartChrome({ theme });
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={[...rows]} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={chrome.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="game"
          type="number"
          domain={[1, "dataMax"]}
          stroke={chrome.axis}
          tick={{ fill: chrome.axis, fontSize: 12 }}
          allowDecimals={false}
          minTickGap={24}
        />
        <YAxis
          stroke={chrome.axis}
          tick={{ fill: chrome.axis, fontSize: 12 }}
          allowDecimals={false}
          width={32}
        />
        <Tooltip content={<ChartTooltip highlighted={active} />} cursor={{ stroke: chrome.axis }} />
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
