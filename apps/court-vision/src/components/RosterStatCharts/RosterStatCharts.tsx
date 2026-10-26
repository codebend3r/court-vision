"use client";

import dynamic from "next/dynamic";

import { ChartPlaceholder } from "@vision/ui/components/ChartPlaceholder/ChartPlaceholder";
import { plotHeight } from "@/components/RosterStatCharts/plotSize";
import { type RosterChart } from "@/lib/roster/charts";
import { type Tier } from "@/lib/roster/compare";

import styles from "@/components/RosterStatCharts/RosterStatCharts.module.scss";

// recharts is the only thing here that needs the browser, and it has nothing
// to render without a measured width, so it loads client-only. Each card keeps
// its name and a text reading in the server HTML; the placeholder holds the
// plot's box until the chart arrives.
const RosterBarPlot = dynamic(
  () => import("@/components/RosterStatCharts/RosterBarPlot").then((mod) => mod.RosterBarPlot),
  { ssr: false, loading: () => <ChartPlaceholder /> },
);

const LEGEND: ReadonlyArray<{ tier: Tier; label: string }> = [
  { tier: "strong", label: "Top third of the league" },
  { tier: "average", label: "Middle third" },
  { tier: "weak", label: "Bottom third" },
  { tier: "neutral", label: "Role, not quality" },
];

type DescribeChartProps = { chart: RosterChart };

const describeChart = ({ chart }: DescribeChartProps): string =>
  `${chart.fullName}, best first: ${chart.bars
    .map((bar) => `${bar.fullName} ${bar.label}`)
    .join(", ")}`;

export type RosterStatChartsProps = {
  label: string;
  charts: readonly RosterChart[];
};

// A chart per stat, each ranking the whole roster at a glance. Bars run best
// first and take their colour from where the player stands in the league, so
// who is carrying the team and who is dragging it reads without a number.
export function RosterStatCharts({ label, charts }: RosterStatChartsProps) {
  const tiersShown = new Set(charts.flatMap((chart) => chart.bars.map((bar) => bar.tier)));
  const hasNeutral = charts.some((chart) => chart.direction === "neutral");

  return (
    <section className={styles.root} aria-label={label}>
      <header className={styles.caption}>
        <p className={styles.hint}>
          Your players on each stat, best first. Colour shows where each stands against the league.
        </p>
        <ul className={styles.legend} aria-label="Colour key">
          {LEGEND.filter(
            ({ tier }) => tiersShown.has(tier) && (tier !== "neutral" || hasNeutral),
          ).map(({ tier, label: tierLabel }) => (
            <li key={tier} className={styles.legendItem}>
              <span className={styles.swatch} data-tier={tier} aria-hidden="true" />
              {tierLabel}
            </li>
          ))}
        </ul>
      </header>
      <ul className={styles.grid}>
        {charts.map((chart) => (
          <li key={chart.key} className={styles.card}>
            <h3 className={styles.title} title={chart.fullName}>
              {chart.label}
              <span className={styles.fullName}>{chart.fullName}</span>
            </h3>
            {chart.bars.length === 0 ? (
              <p className={styles.empty}>No data yet.</p>
            ) : (
              <figure
                className={styles.plot}
                style={{ height: plotHeight({ count: chart.bars.length }) }}
                role="img"
                aria-label={describeChart({ chart })}
              >
                <RosterBarPlot label={chart.label} bars={chart.bars} />
              </figure>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
