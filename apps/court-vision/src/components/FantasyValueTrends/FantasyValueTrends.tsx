"use client";

import { type ReactElement } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayload,
} from "recharts";

import { FantasyChartList } from "@/components/FantasyChartList/FantasyChartList";
import { type FantasyTableRow } from "@/components/FantasyValueTable/FantasyValueTable";
import {
  formatSigned,
  METHOD_LABELS,
  type MethodKey,
} from "@/components/PlayerFantasyChart/labels";
import { getChartChrome, getSeriesPalette } from "@/components/PlayerStatChart/statMeta";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { type FantasySortKey } from "@/lib/valuation/searchParams";
import { type FantasyTrendValue } from "@/lib/valuation/trend";
import { ROLLING_WINDOW_GAMES } from "@/lib/watchlist/trend";

import tooltipStyles from "@/components/MetricLineChart/MetricLineChart.module.scss";
import styles from "@/components/FantasyValueTrends/FantasyValueTrends.module.scss";

export type FantasyTrendRow = FantasyTableRow & { trend: FantasyTrendValue[] };

// The page's game logs arrive after the rows do; the list draws through all
// three states so the layout never jumps.
export type FantasyTrendStatus = "loading" | "ready" | "error";

export type FantasyValueTrendsProps = {
  rows: readonly FantasyTrendRow[];
  status: FantasyTrendStatus;
  // How many of each player's most recent games the charts cover.
  windowGames: number;
  sort: FantasySortKey;
  dir: "asc" | "desc";
  isSignedIn: boolean;
  onSort: (args: { sort: FantasySortKey }) => void;
};

const CHART_HEIGHT = 48;

const METHOD_KEYS: readonly MethodKey[] = ["z", "g"];

const isScored = (point: FantasyTrendValue): boolean => point.z !== null || point.g !== null;

// The games before a player's ten-game window fills have no value. Charting
// them would reserve their width and draw nothing, so each row starts at its
// first game with a value and spans the chart from there.
const plottedPoints = ({ trend }: { trend: readonly FantasyTrendValue[] }): FantasyTrendValue[] => {
  const first = trend.findIndex(isScored);
  return first === -1 ? [] : trend.slice(first);
};

// One symmetric scale for the whole page, so a star's line and a bench
// player's line are comparable at a glance; a flat page still gets a standard
// deviation of headroom rather than magnifying noise.
export const trendDomain = ({ rows }: { rows: readonly FantasyTrendRow[] }): [number, number] => {
  const extent = rows.reduce(
    (max, row) =>
      row.trend.reduce(
        (inner, point) => Math.max(inner, Math.abs(point.z ?? 0), Math.abs(point.g ?? 0)),
        max,
      ),
    1,
  );
  return [-extent, extent];
};

// `gameDate` is UTC midnight; rendering it in UTC keeps the date from
// slipping back a day west of Greenwich.
const formatDate = (isoDate: string): string =>
  new Date(isoDate).toLocaleDateString(undefined, { timeZone: "UTC" });

// Recharts clones `content` and injects `active`/`payload` at render time, so
// they stay optional on the component's own prop type.
export type TrendTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload;
  trend: readonly FantasyTrendValue[];
  colors: Record<MethodKey, string>;
};

// The hovered game, named by its place in the player's season, over its Z
// and G and any missed-game flag.
export function TrendTooltip({
  active,
  payload,
  trend,
  colors,
}: TrendTooltipProps): ReactElement | null {
  if (!active || !payload || !payload.length) {
    return null;
  }
  const hovered: unknown = payload[0].payload;
  if (
    typeof hovered !== "object" ||
    hovered === null ||
    !("gameNumber" in hovered) ||
    typeof hovered.gameNumber !== "number"
  ) {
    return null;
  }
  const point = trend.find((entry) => entry.gameNumber === hovered.gameNumber);
  if (point === undefined) {
    return null;
  }

  return (
    <div className={tooltipStyles.tooltip}>
      <p className={tooltipStyles.tooltipHeader}>
        Game {point.gameNumber} · {formatDate(point.gameDate)}
      </p>
      {METHOD_KEYS.map((key) => {
        const value = point[key];
        return (
          <p key={key} className={tooltipStyles.tooltipRow}>
            <span className={tooltipStyles.dot} style={{ backgroundColor: colors[key] }} />
            {METHOD_LABELS[key]}: {value === null ? "—" : formatSigned(value)}
          </p>
        );
      })}
      {point.dnp && <p className={tooltipStyles.tooltipStatus}>DNP / DNP-CD (0 MIN)</p>}
    </div>
  );
}

const describeTrend = ({ row }: { row: FantasyTrendRow }): string => {
  const plotted = plottedPoints({ trend: row.trend });
  const first = plotted[0];
  const last = plotted.at(-1);
  if (first === undefined || last === undefined) {
    return `${row.fullName} rolling value: not available yet`;
  }
  return (
    `${row.fullName} rolling value: latest Z ${formatSigned(last.z ?? 0)}, ` +
    `G ${formatSigned(last.g ?? 0)}, games ${first.gameNumber} to ${last.gameNumber}`
  );
};

// The Rolling layout: each row carries the player page's rolling ten-game
// value squashed into one wide, short line chart, labelled at both ends with
// the season games it covers. Rows can differ (a traded player, a rookie), so
// the game numbers live on each row rather than once in the header.
export function FantasyValueTrends({
  rows,
  status,
  windowGames,
  sort,
  dir,
  isSignedIn,
  onSort,
}: FantasyValueTrendsProps) {
  const { theme } = useTheme();
  const chrome = getChartChrome({ theme });
  const palette = getSeriesPalette({ theme });
  const colors: Record<MethodKey, string> = { z: palette[0], g: palette[1] };
  const domain = trendDomain({ rows });

  const placeholder = ({ plotted }: { plotted: readonly FantasyTrendValue[] }): string => {
    if (status === "loading") return "Loading rolling value…";
    if (status === "error") return "Unavailable";
    return plotted.length === 0 ? `Needs ${ROLLING_WINDOW_GAMES} games this season` : "";
  };

  return (
    <FantasyChartList
      label="Fantasy value trends"
      hint={`Rolling ${ROLLING_WINDOW_GAMES}-game Z and G over each player's last ${windowGames} games, on one scale shared by every row on this page.`}
      rows={rows}
      sort={sort}
      dir={dir}
      isSignedIn={isSignedIn}
      onSort={onSort}
      busy={status === "loading"}
      notice={
        status === "error" && (
          <p role="alert" className={styles.alert}>
            The game logs for this page could not be loaded, so there is no rolling value to draw.
            Try again in a moment.
          </p>
        )
      }
      bands={<span>Last {windowGames} games</span>}
      describeChart={describeTrend}
      renderChart={({ row }) => {
        const plotted = plottedPoints({ trend: row.trend });
        const hint = placeholder({ plotted });
        const first = plotted[0];
        const last = plotted.at(-1);
        if (hint !== "" || first === undefined || last === undefined) {
          return (
            <div className={styles.plot}>
              <span className={styles.placeholder}>{hint}</span>
              {/* Holds the label row's height so the rows never jump. */}
              <span className={styles.ends} />
            </div>
          );
        }
        return (
          <div className={styles.plot}>
            <ResponsiveContainer
              width="100%"
              height={CHART_HEIGHT}
              initialDimension={{ width: 600, height: CHART_HEIGHT }}
            >
              <LineChart
                data={plotted}
                margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
                // Fifty focusable charts would be fifty tab stops; the row's
                // role="img" label carries the reading instead.
                accessibilityLayer={false}
              >
                <XAxis dataKey="gameNumber" hide />
                <YAxis domain={domain} hide />
                <ReferenceLine y={0} stroke={chrome.axis} />
                <Tooltip
                  content={<TrendTooltip trend={plotted} colors={colors} />}
                  cursor={{ stroke: chrome.axis, strokeDasharray: "3 3" }}
                  allowEscapeViewBox={{ x: false, y: true }}
                  // Lift the bubble over the rows below, which paint later.
                  wrapperStyle={{ zIndex: 30 }}
                />
                {METHOD_KEYS.map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={METHOD_LABELS[key]}
                    stroke={colors[key]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <span className={styles.ends}>
              <span>Game {first.gameNumber}</span>
              <span>Game {last.gameNumber}</span>
            </span>
          </div>
        );
      }}
    />
  );
}
