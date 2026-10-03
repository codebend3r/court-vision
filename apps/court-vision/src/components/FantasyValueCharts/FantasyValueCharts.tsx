"use client";

import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FantasyChartList } from "@/components/FantasyChartList/FantasyChartList";
import { type FantasyTableRow } from "@/components/FantasyValueTable/FantasyValueTable";
import { BreakdownTooltip, SignedBar } from "@/components/PlayerFantasyChart/breakdownChart";
import {
  formatSigned,
  METHOD_LABELS,
  type MethodKey,
} from "@/components/PlayerFantasyChart/labels";
import { getChartChrome, getSeriesPalette } from "@/components/PlayerStatChart/statMeta";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { type FantasyCategoryBreakdown } from "@/lib/valuation/breakdown";
import { type CategoryMeta } from "@/lib/valuation/categories";
import { type FantasySortKey } from "@/lib/valuation/searchParams";

import styles from "@/components/FantasyValueCharts/FantasyValueCharts.module.scss";

export type FantasyChartRow = FantasyTableRow & { breakdown: FantasyCategoryBreakdown[] };

export type FantasyValueChartsProps = {
  rows: readonly FantasyChartRow[];
  // The included categories in band order; every row's breakdown follows it.
  categories: readonly Pick<CategoryMeta, "key" | "label">[];
  sort: FantasySortKey;
  dir: "asc" | "desc";
  isSignedIn: boolean;
  onSort: (args: { sort: FantasySortKey }) => void;
};

// Short enough to read as a row, tall enough that a two-sigma bar and a
// half-sigma bar are still visibly different.
const CHART_HEIGHT = 48;

const METHOD_KEYS: readonly MethodKey[] = ["z", "g"];

// One symmetric scale for the whole page, so a star's bars and a bench
// player's bars are comparable at a glance. A page of near-average players
// still gets a standard deviation of headroom rather than magnifying noise.
export const breakdownDomain = ({
  rows,
}: {
  rows: readonly FantasyChartRow[];
}): [number, number] => {
  const extent = rows.reduce(
    (max, row) =>
      row.breakdown.reduce(
        (inner, entry) => Math.max(inner, Math.abs(entry.z), Math.abs(entry.g)),
        max,
      ),
    1,
  );
  return [-extent, extent];
};

const describeBreakdown = ({ row }: { row: FantasyChartRow }): string =>
  `${row.fullName} category breakdown: ${row.breakdown
    .map((entry) => `${entry.label} Z ${formatSigned(entry.z)} G ${formatSigned(entry.g)}`)
    .join(", ")}`;

// The Categories layout: each row carries the player page's category
// breakdown squashed into one wide, short bar chart.
export function FantasyValueCharts({
  rows,
  categories,
  sort,
  dir,
  isSignedIn,
  onSort,
}: FantasyValueChartsProps) {
  const { theme } = useTheme();
  const chrome = getChartChrome({ theme });
  const palette = getSeriesPalette({ theme });
  const colors: Record<MethodKey, string> = { z: palette[0], g: palette[1] };
  const domain = breakdownDomain({ rows });

  return (
    <FantasyChartList
      label="Fantasy value charts"
      hint="Each category's Z and G, on one scale shared by every row on this page."
      rows={rows}
      sort={sort}
      dir={dir}
      isSignedIn={isSignedIn}
      onSort={onSort}
      bands={
        <span
          className={styles.bandLabels}
          style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}
        >
          {categories.map((category) => (
            <span key={category.key} title={category.label}>
              {category.label}
            </span>
          ))}
        </span>
      }
      describeChart={describeBreakdown}
      renderChart={({ row }) => (
        <ResponsiveContainer
          width="100%"
          height={CHART_HEIGHT}
          initialDimension={{ width: 600, height: CHART_HEIGHT }}
        >
          <BarChart
            data={row.breakdown}
            margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
            barGap={2}
            maxBarSize={12}
            // Fifty focusable charts would be fifty tab stops; the row's
            // role="img" label carries the reading instead.
            accessibilityLayer={false}
          >
            <XAxis dataKey="label" hide />
            <YAxis domain={domain} hide />
            <ReferenceLine y={0} stroke={chrome.axis} />
            <Tooltip
              content={<BreakdownTooltip breakdown={row.breakdown} colors={colors} />}
              cursor={{ fill: chrome.grid, fillOpacity: 0.35 }}
              allowEscapeViewBox={{ x: false, y: true }}
              // Lift the bubble over the rows below, which paint later.
              wrapperStyle={{ zIndex: 30 }}
            />
            {METHOD_KEYS.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                name={METHOD_LABELS[key]}
                fill={colors[key]}
                shape={SignedBar}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    />
  );
}
