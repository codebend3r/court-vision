"use client";

import { useState, type ReactElement } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayload,
} from "recharts";

import type { CumulativePoint } from "@/lib/stats/cumulative";
import type { StatMode } from "@/lib/stats/searchParams";
import { useTheme } from "@/lib/theme/ThemeProvider";

import styles from "./PlayerStatChart.module.scss";
import {
  DEFAULT_ACTIVE_KEYS,
  getChartChrome,
  getStatMeta,
  type ChartChrome,
  type StatKey,
  type StatMeta,
  type StatPanel,
} from "./statMeta";

// `gameDate` is stored as a UTC-midnight ISO string. Formatting it in the
// viewer's local timezone can shift the displayed date back a day for any
// timezone west of UTC, so the date is always rendered in UTC.
const formatDate = (isoDate: string): string =>
  new Date(isoDate).toLocaleDateString(undefined, { timeZone: "UTC" });

// Totals are whole-number sums; averages and per-36 rates keep one decimal.
const formatValue = ({
  value,
  panel,
  mode,
}: {
  value: number;
  panel: StatPanel;
  mode: StatMode;
}): string => {
  if (panel === "shooting") {
    return `${value.toFixed(1)}%`;
  }
  return mode === "totals" ? value.toFixed(0) : value.toFixed(1);
};

const COUNTING_TITLE_BY_MODE: Record<StatMode, string> = {
  avg: "Per-game averages",
  totals: "Accumulating totals",
  per36: "Per 36 minutes",
};

const isCumulativePoint = (value: unknown): value is CumulativePoint => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "gameIndex" in value &&
    typeof value.gameIndex === "number" &&
    "gameDate" in value &&
    typeof value.gameDate === "string" &&
    "matchup" in value &&
    typeof value.matchup === "string" &&
    "pts" in value &&
    (typeof value.pts === "number" || value.pts === null)
  );
};

const renderEndLabel = ({
  label,
  lastIndex,
  fill,
}: {
  label: string;
  lastIndex: number;
  fill: string;
}) =>
  function EndLabel(props: {
    x?: number | string;
    y?: number | string;
    index?: number;
  }): ReactElement | null {
    const { x, y, index } = props;
    if (index !== lastIndex || typeof x !== "number" || typeof y !== "number") {
      return null;
    }
    return (
      <text x={x + 8} y={y + 4} fill={fill} fontSize={12}>
        {label}
      </text>
    );
  };

// Recharts clones `content` (see ContentType in its Tooltip types) and injects
// `active`/`payload` at render time — they are never supplied at JSX-authoring
// time here, so they must stay optional on this component's own prop type.
interface StatTooltipProps {
  active?: boolean;
  payload?: TooltipPayload;
  metas: StatMeta[];
  mode: StatMode;
}

function StatTooltip({ active, payload, metas, mode }: StatTooltipProps): ReactElement | null {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const rawPoint: unknown = payload[0].payload;
  if (!isCumulativePoint(rawPoint)) {
    return null;
  }

  const point = rawPoint;

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipHeader}>
        Game {point.gameIndex} — {formatDate(point.gameDate)} {point.matchup} {point.winLoss ?? ""}
      </p>
      {metas.map((meta) => {
        const value = point[meta.key];
        return (
          <p key={meta.key} className={styles.tooltipRow}>
            <span className={styles.dot} style={{ backgroundColor: meta.color }} />
            {meta.label}: {value === null ? "—" : formatValue({ value, panel: meta.panel, mode })}
          </p>
        );
      })}
    </div>
  );
}

function StatLineChart({
  metas,
  series,
  domain,
  chrome,
  mode,
}: {
  metas: StatMeta[];
  series: CumulativePoint[];
  domain?: [number, number];
  chrome: ChartChrome;
  mode: StatMode;
}) {
  const lastIndex = series.length - 1;

  return (
    <ResponsiveContainer width="100%" height={320} initialDimension={{ width: 800, height: 320 }}>
      <LineChart data={series} margin={{ top: 8, right: 56, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={chrome.grid} vertical={false} />
        <XAxis
          dataKey="gameIndex"
          tick={{ fill: chrome.axis, fontSize: 12 }}
          stroke={chrome.grid}
        />
        <YAxis tick={{ fill: chrome.axis, fontSize: 12 }} stroke={chrome.grid} domain={domain} />
        <Tooltip
          content={<StatTooltip metas={metas} mode={mode} />}
          cursor={{ stroke: chrome.axis, strokeDasharray: "3 3" }}
        />
        {metas.map((meta) => (
          <Line
            key={meta.key}
            type="monotone"
            dataKey={meta.key}
            stroke={meta.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
            connectNulls={false}
            label={renderEndLabel({ label: meta.label, lastIndex, fill: chrome.endLabel })}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PlayerStatChart({ series, mode }: { series: CumulativePoint[]; mode: StatMode }) {
  const { theme } = useTheme();
  const statMeta = getStatMeta({ theme });
  const chrome = getChartChrome({ theme });
  const [active, setActive] = useState<StatKey[]>(DEFAULT_ACTIVE_KEYS);

  const toggle = (key: StatKey) =>
    setActive((current) =>
      current.includes(key) ? current.filter((activeKey) => activeKey !== key) : [...current, key],
    );

  // Per-36 minutes would plot as the constant 36, so MIN sits out that mode.
  const isDisabled = (meta: StatMeta): boolean => mode === "per36" && meta.key === "min";

  const countingActive = statMeta.filter(
    (meta) => meta.panel === "counting" && active.includes(meta.key) && !isDisabled(meta),
  );
  const shootingActive = statMeta.filter(
    (meta) => meta.panel === "shooting" && active.includes(meta.key),
  );

  return (
    <div className={styles.root}>
      <div className={styles.chips}>
        {statMeta.map((meta) => (
          <button
            key={meta.key}
            type="button"
            aria-pressed={active.includes(meta.key) && !isDisabled(meta)}
            disabled={isDisabled(meta)}
            onClick={() => toggle(meta.key)}
            className={styles.chip}
          >
            <span className={styles.dot} style={{ backgroundColor: meta.color }} />
            {meta.label}
          </button>
        ))}
      </div>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>{COUNTING_TITLE_BY_MODE[mode]}</h3>
        {!!countingActive.length ? (
          <StatLineChart metas={countingActive} series={series} chrome={chrome} mode={mode} />
        ) : (
          <p className={styles.emptyHint}>Select a stat to plot</p>
        )}
      </section>

      {!!shootingActive.length && (
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Shooting percentages</h3>
          <StatLineChart
            metas={shootingActive}
            series={series}
            domain={[0, 100]}
            chrome={chrome}
            mode={mode}
          />
        </section>
      )}
    </div>
  );
}
