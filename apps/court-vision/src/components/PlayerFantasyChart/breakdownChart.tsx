"use client";

import { type ReactElement } from "react";
import { Rectangle, type BarShapeProps, type RectangleProps, type TooltipPayload } from "recharts";

import {
  METHOD_KEYS,
  METHOD_LABELS,
  type MethodColors,
} from "@/components/PlayerFantasyChart/labels";
import { SeriesTooltip } from "@/components/SeriesTooltip/SeriesTooltip";
import { formatRate, formatSigned } from "@vision/core/util/format";
import { type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";

// Per-game display beside a category's score: counting stats to one decimal,
// ratio categories as the make rate the Fantasy tab prints (".480").
const formatPerGame = ({ entry }: { entry: FantasyCategoryBreakdown }): string =>
  entry.kind === "ratio" ? formatRate({ value: entry.perGame }) : entry.perGame.toFixed(1);

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
  colors: MethodColors;
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
    <SeriesTooltip
      header={
        <>
          {entry.fullName} · {formatPerGame({ entry })} per game
        </>
      }
      rows={METHOD_KEYS.map((key) => ({
        key,
        label: METHOD_LABELS[key],
        color: colors[key],
        value: formatSigned({ value: entry[key], digits: 1 }),
      }))}
    />
  );
}
