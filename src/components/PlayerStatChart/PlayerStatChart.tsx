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

import styles from "./PlayerStatChart.module.scss";
import {
  DEFAULT_ACTIVE_KEYS,
  STAT_META,
  type StatKey,
  type StatMeta,
  type StatPanel,
} from "./statMeta";

// Recharts SVG presentation attributes can't resolve CSS custom properties
// reliably, so the chart-facing colors below are raw hex. Each is commented
// with the globals.scss token it mirrors.
const GRID_STROKE = "#232a36"; // --color-border
const TICK_FILL = "#9aa4b2"; // --color-text-muted
const END_LABEL_FILL = "#9aa4b2"; // --color-text-muted

// `gameDate` is stored as a UTC-midnight ISO string. Formatting it in the
// viewer's local timezone can shift the displayed date back a day for any
// timezone west of UTC, so the date is always rendered in UTC.
const formatDate = (isoDate: string): string =>
  new Date(isoDate).toLocaleDateString(undefined, { timeZone: "UTC" });

const formatValue = ({ value, panel }: { value: number; panel: StatPanel }): string =>
  panel === "shooting" ? `${value.toFixed(1)}%` : value.toFixed(1);

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
    typeof value.pts === "number"
  );
};

const renderEndLabel = ({ label, lastIndex }: { label: string; lastIndex: number }) =>
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
      <text x={x + 8} y={y + 4} fill={END_LABEL_FILL} fontSize={12}>
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
}

function StatTooltip({ active, payload, metas }: StatTooltipProps): ReactElement | null {
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
            {meta.label}: {value === null ? "—" : formatValue({ value, panel: meta.panel })}
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
}: {
  metas: StatMeta[];
  series: CumulativePoint[];
  domain?: [number, number];
}) {
  const lastIndex = series.length - 1;

  return (
    <ResponsiveContainer width="100%" height={320} initialDimension={{ width: 800, height: 320 }}>
      <LineChart data={series} margin={{ top: 8, right: 56, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="gameIndex" tick={{ fill: TICK_FILL, fontSize: 12 }} stroke={GRID_STROKE} />
        <YAxis tick={{ fill: TICK_FILL, fontSize: 12 }} stroke={GRID_STROKE} domain={domain} />
        <Tooltip
          content={<StatTooltip metas={metas} />}
          cursor={{ stroke: TICK_FILL, strokeDasharray: "3 3" }}
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
            label={renderEndLabel({ label: meta.label, lastIndex })}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PlayerStatChart({ series }: { series: CumulativePoint[] }) {
  const [active, setActive] = useState<StatKey[]>(DEFAULT_ACTIVE_KEYS);

  const toggle = (key: StatKey) =>
    setActive((current) =>
      current.includes(key) ? current.filter((activeKey) => activeKey !== key) : [...current, key],
    );

  const countingActive = STAT_META.filter(
    (meta) => meta.panel === "counting" && active.includes(meta.key),
  );
  const shootingActive = STAT_META.filter(
    (meta) => meta.panel === "shooting" && active.includes(meta.key),
  );

  return (
    <div className={styles.root}>
      <div className={styles.chips}>
        {STAT_META.map((meta) => (
          <button
            key={meta.key}
            type="button"
            aria-pressed={active.includes(meta.key)}
            onClick={() => toggle(meta.key)}
            className={styles.chip}
          >
            <span className={styles.dot} style={{ backgroundColor: meta.color }} />
            {meta.label}
          </button>
        ))}
      </div>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Counting stats</h3>
        {!!countingActive.length ? (
          <StatLineChart metas={countingActive} series={series} />
        ) : (
          <p className={styles.emptyHint}>Select a stat to plot</p>
        )}
      </section>

      {!!shootingActive.length && (
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Shooting percentages</h3>
          <StatLineChart metas={shootingActive} series={series} domain={[0, 100]} />
        </section>
      )}
    </div>
  );
}
