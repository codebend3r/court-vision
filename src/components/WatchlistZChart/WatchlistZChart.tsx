"use client";

import { useEffect, useState } from "react";
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

import { getChartChrome } from "@/components/PlayerStatChart/statMeta";
import { useTheme, type Theme } from "@/lib/theme/ThemeProvider";
import { ROLLING_WINDOW_GAMES, type ZTrendSeries } from "@/lib/watchlist/zTrend";

import styles from "@/components/WatchlistZChart/WatchlistZChart.module.scss";

export type WatchlistZChartProps = {
  series: readonly ZTrendSeries[];
};

// Five solid hues, one per player, in fixed order. Validated with the dataviz
// six checks on adjacent pairs:
//   dark  — all checks pass; worst CVD ΔE 8.4 (protan), above the 8 target.
//   light — darker steps so every 3px line clears 3:1 on white; worst CVD
//           ΔE 6.6 sits in the 6–8 floor band, which is legal here because each
//           line is also directly labelled at its right end and named in the
//           legend, so identity never rests on colour alone.
const SERIES_BY_THEME: Record<Theme, readonly string[]> = {
  dark: ["#3987e5", "#c98500", "#199e70", "#9085e9", "#d55181"],
  light: ["#2a78d6", "#a86a00", "#0f7d55", "#4a3aa7", "#c2185b"],
};

const seriesKey = ({ playerId }: { playerId: number }): string => `p${playerId}`;

const lastNameOf = ({ fullName }: { fullName: string }): string =>
  fullName.split(" ").slice(1).join(" ") || fullName;

const formatDate = (value: number): string =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatZ = (value: number): string => (value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1));

export type ChartRow = Record<string, number | undefined>;

// One row per game date across every series, so the x-axis can be a category
// scale: dates then sit at even intervals however many days apart they are. A
// time scale spaces them by real duration instead, which stretches the all-star
// break into dead space and squeezes busy weeks together.
export const buildRows = ({ series }: { series: readonly ZTrendSeries[] }): ChartRow[] => {
  const dates = [
    ...new Set(series.flatMap((entry) => entry.points.map((point) => point.date))),
  ].sort((a, b) => a - b);
  const byPlayer = new Map(
    series.map((entry) => [
      entry.playerId,
      new Map(entry.points.map((point) => [point.date, point.z])),
    ]),
  );
  return dates.map((date) =>
    series.reduce<ChartRow>(
      (row, entry) => ({
        ...row,
        [seriesKey({ playerId: entry.playerId })]: byPlayer.get(entry.playerId)?.get(date),
      }),
      { date },
    ),
  );
};

const usePrefersReducedMotion = (): boolean => {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setPrefersReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return prefersReduced;
};

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
              {typeof entry.value === "number" ? formatZ(entry.value) : "—"}
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

export function WatchlistZChart({ series }: WatchlistZChartProps) {
  const { theme } = useTheme();
  const chrome = getChartChrome({ theme });
  const palette = SERIES_BY_THEME[theme];
  const prefersReducedMotion = usePrefersReducedMotion();

  const plotted = series.filter((entry) => entry.points.length > 0);

  if (series.length === 0) {
    return (
      <p className={styles.empty}>
        Star players to track how their value trends across the season.
      </p>
    );
  }

  const rows = buildRows({ series });

  return (
    <figure className={styles.figure}>
      <ul className={styles.legend}>
        {series.map((entry, index) => {
          const isPlotted = entry.points.length > 0;
          return (
            <li key={entry.playerId} className={styles.legendItem} data-muted={!isPlotted}>
              <svg className={styles.legendMark} viewBox="0 0 24 8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="24"
                  y2="4"
                  stroke={isPlotted ? palette[index % palette.length] : chrome.axis}
                  strokeWidth="3"
                />
              </svg>
              <span>{entry.fullName}</span>
              {!isPlotted && (
                <span className={styles.legendNote}>— fewer than {ROLLING_WINDOW_GAMES} games</span>
              )}
            </li>
          );
        })}
      </ul>
      {plotted.length === 0 ? (
        <p className={styles.empty}>
          No starred player has {ROLLING_WINDOW_GAMES} games yet this season.
        </p>
      ) : (
        <div className={styles.plot}>
          <ResponsiveContainer width="100%" height={420}>
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
                tickFormatter={formatZ}
                width={48}
              />
              {/* Zero is league-average value: above it a player helps you. */}
              <ReferenceLine y={0} stroke={chrome.axis} strokeDasharray="4 4" />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: chrome.axis }} />
              {series.map((entry, index) => {
                const key = seriesKey({ playerId: entry.playerId });
                // A player can miss the final dates; their name belongs beside
                // their own last point, not at the chart's right edge.
                const lastIndex = rows.reduce(
                  (last, row, rowIndex) => (row[key] === undefined ? last : rowIndex),
                  -1,
                );
                const color = palette[index % palette.length];
                return (
                  <Line
                    key={entry.playerId}
                    dataKey={key}
                    name={entry.fullName}
                    type="monotone"
                    stroke={color}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={!prefersReducedMotion}
                    // A missed game date must not cut the line in half.
                    connectNulls
                  >
                    <LabelList
                      dataKey={key}
                      content={endLabelRenderer({
                        lastIndex,
                        text: lastNameOf({ fullName: entry.fullName }),
                        color,
                      })}
                    />
                  </Line>
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <figcaption className={styles.caption}>
        Rolling {ROLLING_WINDOW_GAMES}-game z-score against this season&apos;s player pool. Zero is
        league-average value.
      </figcaption>
    </figure>
  );
}
