"use client";

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

import type { CumulativePoint } from "@/lib/stats/cumulative";
import type { StatMode } from "@/lib/stats/searchParams";
import { useTheme } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { MetricLineChart } from "@/components/MetricLineChart/MetricLineChart";
import { Switch } from "@vision/ui/components/Switch/Switch";

import styles from "@/components/PlayerStatChart/PlayerStatChart.module.scss";
import {
  DEFAULT_ACTIVE_KEYS,
  getStatMeta,
  STAT_KEYS,
  type StatKey,
  type StatMeta,
  type StatPanel,
} from "@/components/PlayerStatChart/statMeta";

const isStatKey = (value: string): value is StatKey => STAT_KEYS.some((key) => key === value);

const parseVisibleStats = (value: string | null): StatKey[] =>
  value === null ? DEFAULT_ACTIVE_KEYS : value.split(",").filter(isStatKey);

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

export function PlayerStatChart({ series, mode }: { series: CumulativePoint[]; mode: StatMode }) {
  const { theme } = useTheme();
  const statMeta = getStatMeta({ theme });
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

  const formatPanelValue =
    (panel: StatPanel) =>
    ({ value }: { key: StatKey; value: number }) =>
      formatValue({ value, panel, mode });

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
        label="Games missed"
        checked={showDnp}
        onChange={({ checked }) => void setShowDnp(checked)}
      />

      <div className={styles.panels}>
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>{COUNTING_TITLE_BY_MODE[mode]}</h3>
          {!!countingActive.length ? (
            <MetricLineChart
              metas={countingActive}
              series={series}
              showDnp={showDnp}
              formatValue={formatPanelValue("counting")}
            />
          ) : (
            <p className={styles.emptyHint}>Select a stat to plot</p>
          )}
        </section>

        {!!shootingActive.length && (
          <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Shooting percentages</h3>
            <MetricLineChart
              metas={shootingActive}
              series={series}
              domain={[0, 100]}
              showDnp={showDnp}
              formatValue={formatPanelValue("shooting")}
            />
          </section>
        )}
      </div>
    </div>
  );
}
