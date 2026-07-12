"use client";

import { type ReactElement } from "react";
import {
  ArrowRight,
  ArrowUpFromLine,
  CircleGauge,
  CirclePlus,
  Crosshair,
  Shield,
  Sparkles,
  Target,
  Timer,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayload,
} from "recharts";

import type { CumulativePoint } from "@/lib/stats/cumulative";
import type { StatMode } from "@/lib/stats/searchParams";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { Switch } from "@/components/Switch/Switch";
import { TeamMatchup } from "@/components/TeamMatchup/TeamMatchup";

import styles from "@/components/PlayerStatChart/PlayerStatChart.module.scss";
import {
  DEFAULT_ACTIVE_KEYS,
  getChartChrome,
  getStatMeta,
  STAT_KEYS,
  type ChartChrome,
  type StatKey,
  type StatMeta,
  type StatPanel,
} from "./statMeta";

const isStatKey = (value: string): value is StatKey => STAT_KEYS.some((key) => key === value);

const parseVisibleStats = (value: string | null): StatKey[] =>
  value === null ? DEFAULT_ACTIVE_KEYS : value.split(",").filter(isStatKey);

// `gameDate` is stored as a UTC-midnight ISO string. Formatting it in the
// viewer's local timezone can shift the displayed date back a day for any
// timezone west of UTC, so the date is always rendered in UTC.
const formatDate = (isoDate: string): string =>
  new Date(isoDate).toLocaleDateString(undefined, { timeZone: "UTC" });

// Raw per-game values and totals are whole-number counts; averages and per-36
// rates keep one decimal.
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
  return mode === "totals" || mode === "game" ? value.toFixed(0) : value.toFixed(1);
};

const COUNTING_TITLE_BY_MODE: Record<StatMode, string> = {
  avg: "Per-game averages",
  game: "Per-game stats",
  totals: "Accumulating totals",
  per36: "Per 36 minutes",
};

const STAT_ICONS: Record<StatKey, LucideIcon> = {
  pts: CirclePlus,
  reb: ArrowUpFromLine,
  ast: ArrowRight,
  stl: Sparkles,
  blk: Shield,
  min: Timer,
  tov: Undo2,
  fgPct: Target,
  fg3Pct: CircleGauge,
  ftPct: Crosshair,
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

function DnpMarker({
  viewBox,
}: {
  viewBox?: { x?: number; y?: number; height?: number };
}): ReactElement | null {
  const { x, y, height } = viewBox ?? {};
  if (typeof x !== "number" || typeof y !== "number" || typeof height !== "number") {
    return null;
  }

  return (
    <circle
      data-dnp-marker
      aria-hidden="true"
      className={styles.dnpMarker}
      cx={x}
      cy={y + height}
      r={4}
    />
  );
}

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
type StatTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload;
  metas: StatMeta[];
  mode: StatMode;
};

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
        Game {point.gameIndex} · {formatDate(point.gameDate)} ·{" "}
        <TeamMatchup matchup={point.matchup} size="sm" /> {point.winLoss ?? ""}
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
      {point.dnp && <p className={styles.tooltipStatus}>DNP / DNP-CD (0 MIN)</p>}
    </div>
  );
}

function StatLineChart({
  metas,
  series,
  domain,
  chrome,
  mode,
  showDnp,
}: {
  metas: StatMeta[];
  series: CumulativePoint[];
  domain?: [number, number];
  chrome: ChartChrome;
  mode: StatMode;
  showDnp: boolean;
}) {
  const lastIndex = series.length - 1;

  return (
    <ResponsiveContainer width="100%" height={320} initialDimension={{ width: 800, height: 320 }}>
      <LineChart data={series} margin={{ top: 8, right: 56, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={chrome.grid} vertical={false} />
        <XAxis
          dataKey="gameIndex"
          interval="equidistantPreserveStart"
          tick={{ fill: chrome.axis, fontSize: 12 }}
          stroke={chrome.grid}
        />
        <YAxis tick={{ fill: chrome.axis, fontSize: 12 }} stroke={chrome.grid} domain={domain} />
        <Tooltip
          content={<StatTooltip metas={metas} mode={mode} />}
          cursor={{ stroke: chrome.axis, strokeDasharray: "3 3" }}
        />
        {showDnp &&
          series
            .filter((point) => point.dnp)
            .map((point) => (
              <ReferenceLine
                key={point.gameIndex}
                x={point.gameIndex}
                stroke="none"
                label={<DnpMarker />}
              />
            ))}
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
  const [stats, setStats] = useQueryState("stats", parseAsString);
  const [showDnp, setShowDnp] = useQueryState("dnp", parseAsBoolean.withDefault(false));
  const active = parseVisibleStats(stats);

  const toggle = (key: StatKey) => {
    const next = active.includes(key)
      ? active.filter((activeKey) => activeKey !== key)
      : [...active, key];
    void setStats(next.join(","));
  };

  // Per-36 minutes would plot as the constant 36, so MIN sits out that mode.
  const isDisabled = (meta: StatMeta): boolean => mode === "per36" && meta.key === "min";

  const visibleStatMeta =
    mode === "game" ? statMeta.filter((meta) => meta.panel === "counting") : statMeta;
  const countingActive = visibleStatMeta.filter(
    (meta) => meta.panel === "counting" && active.includes(meta.key) && !isDisabled(meta),
  );
  const shootingActive = visibleStatMeta.filter(
    (meta) => meta.panel === "shooting" && active.includes(meta.key),
  );

  // One-shot bulk toggle: clearing everything lets the user focus on a single
  // stat without clicking every chip off first.
  const hasActive = active.length > 0;
  const toggleAll = () =>
    void setStats(hasActive ? "" : visibleStatMeta.map((meta) => meta.key).join(","));

  return (
    <div className={styles.root}>
      <div className={styles.chips}>
        {visibleStatMeta.map((meta) => {
          const Icon = STAT_ICONS[meta.key];
          return (
            <button
              key={meta.key}
              type="button"
              aria-pressed={active.includes(meta.key) && !isDisabled(meta)}
              disabled={isDisabled(meta)}
              onClick={() => toggle(meta.key)}
              className={styles.chip}
            >
              <span className={styles.statIcon} style={{ color: meta.color }} aria-hidden="true">
                <Icon size={16} strokeWidth={2} />
              </span>
              {meta.label}
            </button>
          );
        })}
        <button type="button" onClick={toggleAll} className={styles.chipAction}>
          {hasActive ? "Clear all" : "Select all"}
        </button>
      </div>

      <Switch
        label="Show DNP / DNP-CD"
        checked={showDnp}
        onChange={({ checked }) => void setShowDnp(checked)}
      />

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>{COUNTING_TITLE_BY_MODE[mode]}</h3>
        {!!countingActive.length ? (
          <StatLineChart
            metas={countingActive}
            series={series}
            chrome={chrome}
            mode={mode}
            showDnp={showDnp}
          />
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
            showDnp={showDnp}
          />
        </section>
      )}
    </div>
  );
}
