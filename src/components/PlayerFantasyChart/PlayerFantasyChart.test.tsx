import { cleanup, render, screen } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it } from "bun:test";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import type { FantasyCategoryBreakdown, FantasyTrendPoint } from "@/lib/valuation/playerValue";

import { PlayerFantasyChart } from "@/components/PlayerFantasyChart/PlayerFantasyChart";

afterEach(cleanup);

const breakdown: FantasyCategoryBreakdown[] = [
  { key: "pts", label: "PTS", fullName: "Points", kind: "counting", perGame: 28.4, z: 2.1, g: 1.8 },
  {
    key: "reb",
    label: "REB",
    fullName: "Rebounds",
    kind: "counting",
    perGame: 8.1,
    z: 0.9,
    g: 0.7,
  },
  {
    key: "tov",
    label: "TOV",
    fullName: "Turnovers",
    kind: "counting",
    perGame: 3.9,
    z: -1.4,
    g: -1.1,
  },
  {
    key: "fg",
    label: "FG%",
    fullName: "Field Goal Impact",
    kind: "ratio",
    perGame: 0.48,
    z: 0.2,
    g: 0.2,
  },
];

const trendPoint = ({
  gameIndex,
  z,
  g,
}: {
  gameIndex: number;
  z: number | null;
  g: number | null;
}): FantasyTrendPoint => ({
  gameIndex,
  gameDate: new Date(Date.UTC(2026, 0, gameIndex)).toISOString(),
  matchup: `vs. OPP${gameIndex}`,
  winLoss: "W",
  dnp: false,
  z,
  g,
});

const renderChart = ({ trend }: { trend: FantasyTrendPoint[] }) =>
  render(
    <ThemeProvider>
      <PlayerFantasyChart breakdown={breakdown} trend={trend} />
    </ThemeProvider>,
    { wrapper: withNuqsTestingAdapter({ hasMemory: true }) },
  );

describe("PlayerFantasyChart", () => {
  it("draws a Z and a G bar for every category in the breakdown", () => {
    const { container } = renderChart({
      trend: [1, 2, 3].map((gameIndex) => trendPoint({ gameIndex, z: gameIndex, g: gameIndex })),
    });

    expect(screen.getByText("Category breakdown")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-bar")).toHaveLength(2);
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(
      breakdown.length * 2,
    );
    expect(screen.getByText("PTS")).toBeInTheDocument();
    expect(screen.getByText("FG%")).toBeInTheDocument();
  });

  it("names both series in a legend", () => {
    renderChart({ trend: [] });

    const legend = screen.getByRole("list", { name: "Series" });
    expect(legend).toHaveTextContent("Z-Score");
    expect(legend).toHaveTextContent("G-Score");
  });

  it("plots the rolling value with one line per method once the window has filled", () => {
    const { container } = renderChart({
      trend: [
        trendPoint({ gameIndex: 1, z: null, g: null }),
        trendPoint({ gameIndex: 2, z: 1.2, g: 1.1 }),
        trendPoint({ gameIndex: 3, z: 1.5, g: 1.3 }),
      ],
    });

    expect(screen.getByText("Rolling value")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2);
  });

  it("explains an empty trend instead of drawing it", () => {
    const { container } = renderChart({
      trend: [1, 2, 3].map((gameIndex) => trendPoint({ gameIndex, z: null, g: null })),
    });

    expect(screen.getByText(/needs 10 games/)).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(0);
  });
});
