"use client";

import dynamic from "next/dynamic";

import { Preloader } from "@vision/ui/components/Preloader/Preloader";
import { type FantasyLayout } from "@/lib/valuation/searchParams";

// The two chart layouts are the only recharts consumers on /players, and the
// table is the default layout. Loading them on demand keeps the chart library
// off every tab's critical path. SSR stays on, so a deep link to a chart
// layout still arrives server-rendered and hydrates in place. The Preloader
// only shows on a client-side switch, while the layout's chunk downloads.
export const FantasyValueCharts = dynamic(
  () =>
    import("@/components/FantasyValueCharts/FantasyValueCharts").then(
      (mod) => mod.FantasyValueCharts,
    ),
  { loading: () => <Preloader label="Loading category charts" lines={8} /> },
);

export const FantasyValueTrends = dynamic(
  () =>
    import("@/components/FantasyValueTrends/FantasyValueTrends").then(
      (mod) => mod.FantasyValueTrends,
    ),
  { loading: () => <Preloader label="Loading rolling charts" lines={8} /> },
);

// Hovering or focusing a chart layout's keycap starts its chunk download, so
// the click usually lands on a module that is already there. The specifiers
// match the loaders above, so the bundler resolves both to the same chunk. A
// failed prefetch is ignored; the click retries through next/dynamic.
const ignoreFailure = (): undefined => undefined;
export const PREFETCH_LAYOUT: Record<FantasyLayout, () => void> = {
  table: () => undefined,
  categories: () =>
    void import("@/components/FantasyValueCharts/FantasyValueCharts").catch(ignoreFailure),
  rolling: () =>
    void import("@/components/FantasyValueTrends/FantasyValueTrends").catch(ignoreFailure),
};

export const LAYOUT_LABELS: Record<FantasyLayout, string> = {
  table: "Table",
  categories: "Categories",
  rolling: "Rolling",
};
