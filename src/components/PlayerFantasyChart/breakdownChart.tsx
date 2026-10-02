"use client";

import { type ReactElement } from "react";
import { Rectangle, type BarShapeProps, type RectangleProps, type TooltipPayload } from "recharts";

import {
  formatSigned,
  METHOD_LABELS,
  type MethodKey,
} from "@/components/PlayerFantasyChart/labels";
import type { FantasyCategoryBreakdown } from "@/lib/valuation/breakdown";

import styles from "@/components/PlayerFantasyChart/PlayerFantasyChart.module.scss";

// Per-game display beside a category's score: counting stats to one decimal,
// ratio categories as the make rate the Fantasy tab prints (".480").
const formatPerGame = (entry: FantasyCategoryBreakdown): string =>
  entry.kind === "ratio"
    ? entry.perGame.toFixed(3).replace(/^0(?=\.)/, "")
    : entry.perGame.toFixed(1);

// A bar's rounded end belongs at the data end. Recharts applies `radius` to
// the same rectangle corners whichever way the bar grows, so a negative bar
// needs its bottom corners rounded instead of its top.
export function SignedBar(props: BarShapeProps): ReactElement {
  const value = Array.isArray(props.value) ? props.value[1] - props.value[0] : props.value;
  const radius: NonNullable<RectangleProps["radius"]> = value < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0];
  return (
    <Rectangle
      x={props.x}
      y={props.y}
      width={props.width}
      height={props.height}
      fill={props.fill}
      radius={radius}
    />
  );
}

// Recharts clones `content` and injects `active`/`payload` at render time, so
// they stay optional on the component's own prop type.
export type BreakdownTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload;
  breakdown: readonly FantasyCategoryBreakdown[];
  colors: Record<MethodKey, string>;
};

// The hovered category's full name and per-game line over its Z and G. Shared
// by the player page's breakdown panel and the Fantasy tab's chart rows.
export function BreakdownTooltip({
  active,
  payload,
  breakdown,
  colors,
}: BreakdownTooltipProps): ReactElement | null {
  if (!active || !payload || !payload.length) {
    return null;
  }
  const hovered: unknown = payload[0].payload;
  if (typeof hovered !== "object" || hovered === null || !("key" in hovered)) {
    return null;
  }
  const entry = breakdown.find((candidate) => candidate.key === hovered.key);
  if (entry === undefined) {
    return null;
  }

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipHeader}>
        {entry.fullName} · {formatPerGame(entry)} per game
      </p>
      <p className={styles.tooltipRow}>
        <span className={styles.dot} style={{ backgroundColor: colors.z }} />
        {METHOD_LABELS.z}: {formatSigned(entry.z)}
      </p>
      <p className={styles.tooltipRow}>
        <span className={styles.dot} style={{ backgroundColor: colors.g }} />
        {METHOD_LABELS.g}: {formatSigned(entry.g)}
      </p>
    </div>
  );
}
