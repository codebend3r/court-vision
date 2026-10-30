"use client";

import { type ReactElement } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayload,
} from "recharts";

import { FantasyChartList } from "@/components/FantasyChartList/FantasyChartList";
import { VALUE_LABELS, type ValueColors } from "@/components/PlayerFantasyChart/labels";
import { TrendChartControls } from "@/components/TrendChartControls/TrendChartControls";
import { useTrendChartPrefs } from "@/components/TrendChartControls/useTrendChartPrefs";
import { AVERAGE_LINE_LABEL, AVERAGE_LINE_STYLE } from "@/lib/charts/averageLine";
import { fittedDomain, type TrendSpan, visibleMethods } from "@/lib/charts/trendMethods";
import { type MethodValueKey } from "@vision/core/valuation/types";
import { SeriesTooltip } from "@/components/SeriesTooltip/SeriesTooltip";
import { CHART_CHROME } from "@vision/ui/charts/palette";
import { formatSigned } from "@vision/core/util/format";
import { type FantasyTableRow, type ListSortProps } from "@/lib/valuation/fantasyRows";
import { type FantasyTrendValue } from "@vision/core/valuation/trend";
import { type DatedMethodValues } from "@vision/core/valuation/leagueAverage";
import { ROLLING_WINDOW_GAMES } from "@vision/core/valuation/rolling";

import styles from "@/components/FantasyValueTrends/FantasyValueTrends.module.scss";

export type FantasyTrendRow = FantasyTableRow & { trend: FantasyTrendValue[] };

// The page's game logs arrive after the rows do; the list draws through all
// three states so the layout never jumps.
export type FantasyTrendStatus = "loading" | "ready" | "error";

export type FantasyValueTrendsProps = ListSortProps & {
  rows: readonly FantasyTrendRow[];
  status: FantasyTrendStatus;
  // How many of each player's most recent games the charts cover; null is the
  // whole season.
  windowGames: number | null;
  // The timeframe control's value; omitted hides the control.
  span?: TrendSpan;
  onSpan?: (span: TrendSpan) => void;
  // The league's average on every method per game date, drawn as a dotted
  // line that moves with the league.
  averages?: readonly DatedMethodValues[];
};

// Short on purpose: seven of these sit side by side in every row.
const CHART_HEIGHT = 44;

// Every method scores the same windows, so Z having a value means they all do.
const isScored = (point: FantasyTrendValue): boolean => point.z !== null || point.g !== null;

// The games before a player's first appearance have no value. Charting
// them would reserve their width and draw nothing, so each row starts at its
// first game with a value and spans the chart from there.
type PlottedPointsProps = { trend: readonly FantasyTrendValue[] };

const plottedPoints = ({ trend }: PlottedPointsProps): FantasyTrendValue[] => {
  const first = trend.findIndex(isScored);
  return first === -1 ? [] : trend.slice(first);
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
  colors: ValueColors;
  // The methods drawn, named in the tooltip.
  keys?: readonly MethodValueKey[];
};

// The hovered game, named by its place in the player's season, over its Z
// and G and any missed-game flag.
export function TrendTooltip({
  active,
  payload,
  trend,
  colors,
  keys = ["z", "g"],
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
    <SeriesTooltip
      header={`Game ${point.gameNumber} · ${formatDate(point.gameDate)}`}
      rows={[
        ...keys.map((key) => {
          const value = point[key];
          return {
            key,
            label: VALUE_LABELS[key],
            color: colors[key],
            value: value === null ? "—" : formatSigned({ value, digits: 1 }),
          };
        }),
        // A sparkline's hovered row carries that date's league average.
        ...("average" in hovered && typeof hovered.average === "number"
          ? [
              {
                key: "average",
                label: AVERAGE_LINE_LABEL,
                color: AVERAGE_LINE_STYLE.stroke,
                value: formatSigned({ value: hovered.average, digits: 1 }),
              },
            ]
          : []),
      ]}
      status={point.dnp ? "DNP / DNP-CD (0 MIN)" : undefined}
    />
  );
}

type DescribeTrendProps = { row: FantasyTrendRow; keys: readonly MethodValueKey[] };

const describeTrend = ({ row, keys }: DescribeTrendProps): string => {
  const plotted = plottedPoints({ trend: row.trend });
  const first = plotted[0];
  const last = plotted.at(-1);
  if (first === undefined || last === undefined) {
    return `${row.fullName} rolling value: not available yet`;
  }
  return (
    `${row.fullName} rolling value: latest ` +
    keys
      .map((key) => `${VALUE_LABELS[key]} ${formatSigned({ value: last[key] ?? 0, digits: 1 })}`)
      .join(", ") +
    `, games ${first.gameNumber} to ${last.gameNumber}`
  );
};

// The row field a sparkline's league-average line reads.
const AVERAGE_KEY = "average";

// One method's sparkline for one player: its own fitted scale (so a swing
// fills the box), the league's average on each of the player's game dates
// dotted beneath it, and a tooltip naming the hovered game.
type SparklineProps = {
  plotted: readonly FantasyTrendValue[];
  methodKey: MethodValueKey;
  color: string;
  colors: ValueColors;
  // The league average by game date, or null to draw none.
  averageByDate: ReadonlyMap<number, DatedMethodValues["values"]> | null;
};

function Sparkline({ plotted, methodKey, color, colors, averageByDate }: SparklineProps) {
  const data = plotted.map((point) => ({
    ...point,
    [AVERAGE_KEY]: averageByDate?.get(Date.parse(point.gameDate))?.[methodKey] ?? null,
  }));
  return (
    <ResponsiveContainer
      width="100%"
      height={CHART_HEIGHT}
      initialDimension={{ width: 120, height: CHART_HEIGHT }}
    >
      <LineChart
        data={data}
        margin={{ top: 3, right: 0, bottom: 3, left: 0 }}
        // Hundreds of focusable charts would be hundreds of tab stops; the
        // row's role="img" label carries the reading instead.
        accessibilityLayer={false}
      >
        <XAxis dataKey="gameNumber" hide />
        <YAxis
          domain={fittedDomain({
            values: data.flatMap((point) => [point[methodKey], point[AVERAGE_KEY]]),
          })}
          allowDataOverflow
          hide
        />
        <Tooltip
          content={<TrendTooltip trend={plotted} colors={colors} keys={[methodKey]} />}
          cursor={{ stroke: CHART_CHROME.axis, strokeDasharray: "3 3" }}
          allowEscapeViewBox={{ x: true, y: true }}
          // Lift the bubble over the rows below, which paint later.
          wrapperStyle={{ zIndex: 30 }}
        />
        <Line
          type="linear"
          dataKey={methodKey}
          name={VALUE_LABELS[methodKey]}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
          isAnimationActive={false}
          connectNulls={false}
        />
        {averageByDate !== null && (
          <Line
            type="linear"
            dataKey={AVERAGE_KEY}
            name={AVERAGE_LINE_LABEL}
            {...AVERAGE_LINE_STYLE}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            connectNulls
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

// The Rolling layout: each row carries one compact chart per fantasy method,
// side by side, over the timeframe the reader picks (the whole season by
// default). Every chart fits its own scale, so a jump in any method is
// obvious, and the row is labelled with the season games it covers. Rows can
// differ (a traded player, a rookie), so the game numbers live on each row.
export function FantasyValueTrends({
  rows,
  status,
  windowGames,
  span,
  onSpan,
  averages = [],
  ...listProps
}: FantasyValueTrendsProps) {
  const { hidden, showAverage } = useTrendChartPrefs();
  const keys = visibleMethods({ hidden });
  // No line at all when hidden or before the league has a reading.
  const averageByDate =
    showAverage && !!averages.length
      ? new Map(averages.map(({ date, values }) => [date, values]))
      : null;

  type PlaceholderProps = { plotted: readonly FantasyTrendValue[] };

  const placeholder = ({ plotted }: PlaceholderProps): string => {
    if (status === "loading") return "Loading rolling value…";
    if (status === "error") return "Unavailable";
    return plotted.length === 0 ? "No games this season" : "";
  };

  const spanText = windowGames === null ? "this season" : `each player's last ${windowGames} games`;

  return (
    <FantasyChartList
      label="Fantasy value trends"
      hint={`Rolling value on each method over ${spanText}, each point scoring up to the ${ROLLING_WINDOW_GAMES} games before it (fewer early in the season). Every chart fits its own scale, so a jump in form fills the box.`}
      rows={rows}
      legend={[]}
      controls={<TrendChartControls span={span} onSpan={onSpan} />}
      {...listProps}
      busy={status === "loading"}
      notice={
        status === "error" && (
          <p role="alert" className={styles.alert}>
            The game logs for this page could not be loaded, so there is no rolling value to draw.
            Try again in a moment.
          </p>
        )
      }
      bands={
        <span className={styles.multiples} data-count={keys.length}>
          {keys.map((key) => (
            <span key={key} className={styles.band}>
              {VALUE_LABELS[key]}
            </span>
          ))}
        </span>
      }
      describeChart={({ row }) => describeTrend({ row, keys })}
      renderChart={({ row, colors }) => {
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
            <div className={styles.multiples} data-count={keys.length}>
              {keys.map((key) => (
                <div key={key} className={styles.cell} data-method={key}>
                  <Sparkline
                    plotted={plotted}
                    methodKey={key}
                    color={colors[key]}
                    colors={colors}
                    averageByDate={averageByDate}
                  />
                </div>
              ))}
            </div>
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
