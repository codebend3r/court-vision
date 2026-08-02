"use client";

import { useState } from "react";
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
import { NBA_TEAMS, TeamChip, type TeamAbbreviation } from "@/components/TeamChip/TeamChip";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { useTheme, type Theme } from "@/lib/theme/ThemeProvider";
import { type WinsRow } from "@/lib/teams/trend";

import styles from "@/components/StandingsTrendChart/StandingsTrendChart.module.scss";

export type StandingsTrendChartProps = {
  title: string;
  teams: ReadonlyArray<{ abbr: TeamAbbreviation; name: string }>;
  rows: readonly WinsRow[];
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

export function StandingsTrendChart({ title, teams, rows }: StandingsTrendChartProps) {
  const { theme } = useTheme();
  const chrome = getChartChrome({ theme });
  const prefersReducedMotion = usePrefersReducedMotion();
  const [pinned, setPinned] = useState<TeamAbbreviation | null>(null);
  const [hovered, setHovered] = useState<TeamAbbreviation | null>(null);

  if (rows.length === 0) return null;

  const active = pinned ?? hovered;
  const lastRow = rows[rows.length - 1];
  const leader = [...teams].sort(
    (a, b) => (lastRow?.[b.abbr] ?? -1) - (lastRow?.[a.abbr] ?? -1),
  )[0];
  const leaderWins = leader === undefined ? 0 : (lastRow?.[leader.abbr] ?? 0);

  const togglePin = ({ abbr }: { abbr: TeamAbbreviation }) =>
    setPinned((current) => (current === abbr ? null : abbr));

  return (
    <figure
      className={styles.figure}
      onKeyDown={(event) => {
        if (event.key === "Escape") setPinned(null);
      }}
    >
      {!!leader && (
        <p className={styles.summary}>
          Best record: {leader.name}, {leaderWins} wins through {rows.length} games.
        </p>
      )}
      <div className={styles.plot} aria-label={`${title} cumulative wins`} role="img">
        <ResponsiveContainer width="100%" height={256}>
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
            <Tooltip
              content={<ChartTooltip highlighted={active} />}
              cursor={{ stroke: chrome.axis }}
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
                  onMouseEnter={() => setHovered(team.abbr)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className={styles.legend}>
        {teams.map((team) => {
          const hasData = rows.some((row) => row[team.abbr] !== undefined);
          return (
            <li key={team.abbr}>
              <button
                type="button"
                className={styles.legendChip}
                aria-pressed={pinned === team.abbr}
                data-dimmed={
                  (active !== null && active !== team.abbr) || !hasData ? "true" : undefined
                }
                onClick={() => togglePin({ abbr: team.abbr })}
                onMouseEnter={() => setHovered(team.abbr)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(team.abbr)}
                onBlur={() => setHovered(null)}
              >
                <span aria-hidden="true">
                  <TeamChip team={team.abbr} size="sm" />
                </span>
                <span className={styles.legendName}>{team.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
