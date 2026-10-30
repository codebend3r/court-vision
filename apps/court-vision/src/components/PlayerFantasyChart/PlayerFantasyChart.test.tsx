import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it } from "bun:test";

import { ThemeProvider } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";
import { type FantasyTrendPoint } from "@vision/core/valuation/playerValue";

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

type TrendPointProps = {
  gameIndex: number;
  z: number | null;
  g: number | null;
};

const trendPoint = ({ gameIndex, z, g }: TrendPointProps): FantasyTrendPoint => ({
  gameIndex,
  gameNumber: gameIndex,
  gameDate: new Date(Date.UTC(2026, 0, gameIndex)).toISOString(),
  matchup: `vs. OPP${gameIndex}`,
  winLoss: "W",
  dnp: false,
  z,
  g,
  // The other methods move with Z, on their own scales.
  points: z === null ? null : 30 + z * 4,
  vorp: z === null ? null : z - 1,
  positional: z === null ? null : z - 0.5,
  sgp: z === null ? null : z / 2,
  sim: z === null ? null : z / 10,
});

// The league's average on each fixture game date, a little lower each day.
const AVERAGES = [1, 2, 3].map((day) => ({
  date: Date.UTC(2026, 0, day),
  values: { z: -day / 10, g: 0, points: 22, vorp: -2, positional: -1.5, sgp: 0, sim: 0 },
}));

type RenderChartProps = { trend: FantasyTrendPoint[] };

const renderChart = ({ trend }: RenderChartProps) =>
  render(
    <ThemeProvider>
      <PlayerFantasyChart breakdown={breakdown} trend={trend} averages={AVERAGES} />
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

  it("plots one small rolling chart per method", () => {
    const { container } = renderChart({
      trend: [
        trendPoint({ gameIndex: 1, z: null, g: null }),
        trendPoint({ gameIndex: 2, z: 1.2, g: 1.1 }),
        trendPoint({ gameIndex: 3, z: 1.5, g: 1.3 }),
      ],
    });

    expect(screen.getByText("Rolling value")).toBeInTheDocument();
    // Seven methods, each over its dotted league-average line.
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(14);
    expect(screen.getByRole("heading", { name: "Sim Value" })).toBeInTheDocument();
  });

  it("explains an empty trend instead of drawing it", () => {
    const { container } = renderChart({
      trend: [1, 2, 3].map((gameIndex) => trendPoint({ gameIndex, z: null, g: null })),
    });

    expect(screen.getByText(/No games in this timeframe/)).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(0);
  });

  it("hides a method's chart from the controls, with the average on by default", () => {
    const { container } = renderChart({
      trend: [1, 2, 3].map((gameIndex) => trendPoint({ gameIndex, z: gameIndex / 2, g: 0.1 })),
    });

    expect(screen.getByRole("checkbox", { name: "League average" })).toBeChecked();
    const charts = within(screen.getByRole("group", { name: "Charts shown" }));
    fireEvent.click(charts.getByRole("button", { name: "SGP" }));
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(12);
    expect(screen.queryByRole("heading", { name: "SGP" })).not.toBeInTheDocument();
  });
});
