"use client";

import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FantasyChartList } from "@/components/FantasyChartList/FantasyChartList";
import { BreakdownTooltip, SignedBar } from "@/components/PlayerFantasyChart/breakdownChart";
import {
  METHOD_KEYS,
  METHOD_LABELS,
  symmetricDomain,
} from "@/components/PlayerFantasyChart/labels";
import { CHART_CHROME } from "@vision/ui/charts/palette";
import { formatSigned } from "@vision/core/util/format";
import { type CategoryMeta, type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";
import { type FantasyTableRow, type ListSortProps } from "@/lib/valuation/fantasyRows";

import styles from "@/components/FantasyValueCharts/FantasyValueCharts.module.scss";

export type FantasyChartRow = FantasyTableRow & { breakdown: FantasyCategoryBreakdown[] };

export type FantasyValueChartsProps = ListSortProps & {
  rows: readonly FantasyChartRow[];
  // The included categories in band order; every row's breakdown follows it.
  categories: readonly Pick<CategoryMeta, "key" | "label">[];
};

// Short enough to read as a row, tall enough that a two-sigma bar and a
// half-sigma bar are still visibly different.
const CHART_HEIGHT = 48;

type DescribeBreakdownProps = { row: FantasyChartRow };

const describeBreakdown = ({ row }: DescribeBreakdownProps): string =>
  `${row.fullName} category breakdown: ${row.breakdown
    .map(
      (entry) =>
        `${entry.label} Z ${formatSigned({ value: entry.z, digits: 1 })} ` +
        `G ${formatSigned({ value: entry.g, digits: 1 })}`,
    )
    .join(", ")}`;

// The Categories layout: each row carries the player page's category
// breakdown squashed into one wide, short bar chart, every row on one scale.
export function FantasyValueCharts({ rows, categories, ...listProps }: FantasyValueChartsProps) {
  const domain = symmetricDomain({ points: rows.flatMap((row) => row.breakdown) });

  return (
    <FantasyChartList
      label="Fantasy value charts"
      hint="Each category's Z and G, on one scale shared by every row on this page."
      rows={rows}
      {...listProps}
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
      renderChart={({ row, colors }) => (
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
            <ReferenceLine y={0} stroke={CHART_CHROME.axis} />
            <Tooltip
              content={<BreakdownTooltip breakdown={row.breakdown} colors={colors} />}
              cursor={{ fill: CHART_CHROME.grid, fillOpacity: 0.35 }}
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
