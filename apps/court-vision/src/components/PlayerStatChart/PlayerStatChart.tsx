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

import type { CumulativePoint } from "@/lib/stats/cumulative";
import type { StatMode } from "@/lib/stats/searchParams";
import { useTheme } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { MetricLineChart } from "@/components/MetricLineChart/MetricLineChart";
import { ChartPanel } from "@/components/SeriesChart/ChartPanel";
import { GamesMissedSwitch, useShowDnp } from "@/components/SeriesChart/GamesMissedSwitch";
import { SeriesChips } from "@/components/SeriesChart/SeriesChips";
import { useSeriesSelection } from "@/components/SeriesChart/useSeriesSelection";

import styles from "@/components/PlayerStatChart/PlayerStatChart.module.scss";
import chartStyles from "@/components/SeriesChart/SeriesChart.module.scss";
import {
  DEFAULT_ACTIVE_KEYS,
  getStatMeta,
  STAT_KEYS,
  type StatKey,
  type StatMeta,
  type StatPanel,
} from "@/components/PlayerStatChart/statMeta";

// Raw per-game values and totals are whole-number counts; averages and per-36
// rates keep one decimal.
const formatValue = ({
  key,
  value,
  panel,
  mode,
}: {
  key: StatKey;
  value: number;
  panel: StatPanel;
  mode: StatMode;
}): string => {
  if (panel === "shooting") {
    return `${value.toFixed(1)}%`;
  }
  // Minutes are whole in every mode, an average included.
  if (key === "min") return value.toFixed(0);
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
  const selection = useSeriesSelection({
    param: "stats",
    keys: STAT_KEYS,
    defaults: DEFAULT_ACTIVE_KEYS,
  });
  const { showDnp } = useShowDnp();

  // Per-36 minutes would plot as the constant 36, so MIN sits out that mode.
  const isDisabled = (meta: StatMeta): boolean => mode === "per36" && meta.key === "min";

  const visibleStatMeta =
    mode === "game" ? statMeta.filter((meta) => meta.panel === "counting") : statMeta;
  const countingActive = visibleStatMeta.filter(
    (meta) =>
      meta.panel === "counting" && selection.isActive({ key: meta.key }) && !isDisabled(meta),
  );
  const shootingActive = visibleStatMeta.filter(
    (meta) => meta.panel === "shooting" && selection.isActive({ key: meta.key }),
  );

  const formatPanelValue =
    (panel: StatPanel) =>
    ({ key, value }: { key: StatKey; value: number }) =>
      formatValue({ key, value, panel, mode });

  return (
    <div className={chartStyles.root}>
      <SeriesChips
        selection={selection}
        all={visibleStatMeta.map((meta) => meta.key)}
        chips={visibleStatMeta.map((meta) => {
          const Icon = STAT_ICONS[meta.key];
          return {
            key: meta.key,
            label: meta.label,
            disabled: isDisabled(meta),
            mark: (
              <span className={styles.statIcon} style={{ color: meta.color }} aria-hidden="true">
                <Icon size={16} strokeWidth={2} />
              </span>
            ),
          };
        })}
      />

      <GamesMissedSwitch />

      <div className={styles.panels}>
        <ChartPanel title={COUNTING_TITLE_BY_MODE[mode]}>
          {!!countingActive.length ? (
            <MetricLineChart
              metas={countingActive}
              series={series}
              showDnp={showDnp}
              formatValue={formatPanelValue("counting")}
            />
          ) : (
            <p className={chartStyles.emptyHint}>Select a stat to plot</p>
          )}
        </ChartPanel>

        {!!shootingActive.length && (
          <ChartPanel title="Shooting percentages">
            <MetricLineChart
              metas={shootingActive}
              series={series}
              domain={[0, 100]}
              showDnp={showDnp}
              formatValue={formatPanelValue("shooting")}
            />
          </ChartPanel>
        )}
      </div>
    </div>
  );
}
