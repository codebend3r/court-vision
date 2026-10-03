import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import {
  MetricLineChart,
  type MetricSeriesPoint,
} from "@/components/MetricLineChart/MetricLineChart";

afterEach(cleanup);

type Key = "alpha" | "beta";

const series: MetricSeriesPoint<Key>[] = [1, 2, 3, 4].map((gameIndex) => ({
  gameIndex,
  gameDate: new Date(Date.UTC(2026, 0, gameIndex)).toISOString(),
  matchup: `vs. OPP${gameIndex}`,
  winLoss: "W",
  dnp: gameIndex === 2,
  alpha: gameIndex * 10,
  beta: gameIndex === 2 ? null : gameIndex,
}));

const metas = [
  { key: "alpha" as const, label: "Alpha", color: "#111111" },
  { key: "beta" as const, label: "Beta", color: "#222222" },
];

const renderChart = ({
  showDnp = false,
  only,
  endLabels,
  points = series,
}: {
  showDnp?: boolean;
  only?: Key[];
  endLabels?: boolean;
  points?: MetricSeriesPoint<Key>[];
} = {}) =>
  render(
    <ThemeProvider>
      <MetricLineChart
        metas={only ? metas.filter((meta) => only.includes(meta.key)) : metas}
        series={points}
        showDnp={showDnp}
        endLabels={endLabels}
        formatValue={({ value }) => value.toFixed(1)}
      />
    </ThemeProvider>,
  );

// The x position recharts resolved for the label, so a label can be tied to
// the point it was drawn beside.
const labelX = (text: string): number =>
  Number(screen.getByText(text).getAttribute("x") ?? Number.NaN);

describe("MetricLineChart", () => {
  it("draws one line per metric and labels each at its end", () => {
    const { container } = renderChart();

    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("draws only the metrics it is given", () => {
    const { container } = renderChart({ only: ["beta"] });

    expect(container.querySelectorAll(".recharts-line")).toHaveLength(1);
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("labels a line at its last real point, not at a trailing missed game", () => {
    // Beta's final game is a DNP: its line ends one game before Alpha's.
    const points = series.map((point, index) =>
      index === series.length - 1 ? { ...point, dnp: true, beta: null } : point,
    );
    renderChart({ points });

    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(labelX("Beta")).toBeLessThan(labelX("Alpha"));
  });

  it("can leave the end labels off for a dense panel", () => {
    const { container } = renderChart({ endLabels: false });

    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2);
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("marks missed games only when asked", () => {
    const { container: hidden } = renderChart();
    expect(hidden.querySelectorAll("[data-dnp-marker]")).toHaveLength(0);
    cleanup();

    const { container: shown } = renderChart({ showDnp: true });
    expect(shown.querySelectorAll("[data-dnp-marker]")).toHaveLength(1);
  });
});
