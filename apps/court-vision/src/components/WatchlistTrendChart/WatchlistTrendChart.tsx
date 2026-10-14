"use client";

import dynamic from "next/dynamic";

import { ChartPlaceholder } from "@vision/ui/components/ChartPlaceholder/ChartPlaceholder";
import { CHART_CHROME, getTrendPalette } from "@vision/ui/charts/palette";
import type { WatchlistTrendLine } from "@/components/WatchlistTrendChart/WatchlistTrendPlot";
import { useTheme } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { ROLLING_WINDOW_GAMES, type TrendSeries } from "@vision/core/valuation/rolling";

import styles from "@/components/WatchlistTrendChart/WatchlistTrendChart.module.scss";

// The plot is the only part of this figure that needs recharts, and it has
// nothing to server-render without a measured width. Loading it client-only
// keeps the chart library off the home page's critical path. The legend,
// caption, and empty states still arrive in the server HTML, and the
// placeholder holds the plot box until the chart lands.
const WatchlistTrendPlot = dynamic(
  () =>
    import("@/components/WatchlistTrendChart/WatchlistTrendPlot").then(
      (mod) => mod.WatchlistTrendPlot,
    ),
  { ssr: false, loading: () => <ChartPlaceholder /> },
);

export type WatchlistTrendChartProps = {
  series: readonly TrendSeries[];
  // What the plotted number means — rendered as the figure's caption. The
  // chart itself is method-agnostic; z- and g-score instances differ only here.
  caption: string;
};

const seriesKey = ({ playerId }: { playerId: number }): string => `p${playerId}`;

const lastNameOf = ({ fullName }: { fullName: string }): string =>
  fullName.split(" ").slice(1).join(" ") || fullName;

export type ChartRow = Record<string, number | undefined>;

// One row per game date across every series, so the x-axis can be a category
// scale: dates then sit at even intervals however many days apart they are. A
// time scale spaces them by real duration instead, which stretches the all-star
// break into dead space and squeezes busy weeks together.
export const buildRows = ({ series }: { series: readonly TrendSeries[] }): ChartRow[] => {
  const dates = [
    ...new Set(series.flatMap((entry) => entry.points.map((point) => point.date))),
  ].sort((a, b) => a - b);
  const byPlayer = new Map(
    series.map((entry) => [
      entry.playerId,
      new Map(entry.points.map((point) => [point.date, point.value])),
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

export function WatchlistTrendChart({ series, caption }: WatchlistTrendChartProps) {
  const { theme } = useTheme();
  const palette = getTrendPalette({ theme });

  const plotted = series.filter((entry) => entry.points.length > 0);

  if (series.length === 0) {
    return (
      <p className={styles.empty}>
        Star players to track how their value trends across the season.
      </p>
    );
  }

  const rows = buildRows({ series });
  const lines = series.map((entry, index): WatchlistTrendLine => ({
    dataKey: seriesKey({ playerId: entry.playerId }),
    name: entry.fullName,
    endLabel: lastNameOf({ fullName: entry.fullName }),
    color: palette[index % palette.length],
  }));

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
                  stroke={isPlotted ? palette[index % palette.length] : CHART_CHROME.axis}
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
          <WatchlistTrendPlot rows={rows} lines={lines} />
        </div>
      )}
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  );
}
