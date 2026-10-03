import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it } from "bun:test";

import { ADVANCED_STAT_META } from "@/lib/players/advancedStatMeta";
import type { AdvancedPoint } from "@/lib/stats/advancedSeries";
import { ThemeProvider } from "@vision/ui/components/ThemeProvider/ThemeProvider";

import { PlayerAdvancedChart } from "@/components/PlayerAdvancedChart/PlayerAdvancedChart";

afterEach(cleanup);

const buildSeries = (): AdvancedPoint[] =>
  [1, 2, 3, 4, 5].map((gameIndex) => ({
    gameIndex,
    gameDate: new Date(Date.UTC(2026, 0, gameIndex)).toISOString(),
    matchup: `vs. OPP${gameIndex}`,
    winLoss: gameIndex % 2 === 0 ? "L" : "W",
    dnp: gameIndex === 3,
    pie: 0.1 + gameIndex / 100,
    pace: 100 + gameIndex,
    assistPercentage: 0.3,
    assistRatio: 20,
    assistToTurnover: 2,
    defensiveRating: 110,
    defensiveReboundPercentage: 0.2,
    effectiveFieldGoalPercentage: 0.55,
    netRating: gameIndex - 3,
    offensiveRating: 115,
    offensiveReboundPercentage: 0.02,
    reboundPercentage: 0.11,
    trueShootingPercentage: 0.6,
    turnoverRatio: 12,
    usagePercentage: 0.3,
  }));

const renderChart = ({
  mode = "game",
  searchParams = {},
}: { mode?: "game" | "avg"; searchParams?: Record<string, string> } = {}) =>
  render(
    <ThemeProvider>
      <PlayerAdvancedChart series={buildSeries()} mode={mode} />
    </ThemeProvider>,
    { wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams }) },
  );

describe("PlayerAdvancedChart", () => {
  it("renders a pressed chip per advanced metric plus the bulk action", () => {
    renderChart();

    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(ADVANCED_STAT_META.length + 1);
    expect(chips.filter((chip) => chip.getAttribute("aria-pressed") === "true")).toHaveLength(
      ADVANCED_STAT_META.length,
    );
    expect(screen.getByRole("button", { name: "TS%" })).toBeInTheDocument();
  });

  it("groups the metrics into four scale panels with a line each", () => {
    const { container } = renderChart();

    expect(screen.getByText("Shooting efficiency")).toBeInTheDocument();
    expect(screen.getByText("Shares")).toBeInTheDocument();
    expect(screen.getByText("Ratings & pace")).toBeInTheDocument();
    expect(screen.getByText("Ratios")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(ADVANCED_STAT_META.length);
  });

  it("captions the panels by mode", () => {
    renderChart({ mode: "game" });
    expect(screen.getByText("Per-game values")).toBeInTheDocument();
    cleanup();

    renderChart({ mode: "avg" });
    expect(screen.getByText("Running averages")).toBeInTheDocument();
  });

  it("drops a panel once every metric in it is toggled off", async () => {
    const user = userEvent.setup();
    const { container } = renderChart();

    await user.click(screen.getByRole("button", { name: "TS%" }));
    await user.click(screen.getByRole("button", { name: "EFG%" }));

    await waitFor(() => {
      expect(screen.queryByText("Shooting efficiency")).not.toBeInTheDocument();
      expect(container.querySelectorAll(".recharts-line")).toHaveLength(
        ADVANCED_STAT_META.length - 2,
      );
    });
  });

  it("restores the chip selection from the URL", () => {
    const { container } = renderChart({ searchParams: { adv: "pie,pace" } });

    expect(screen.getByRole("button", { name: "PIE" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "TS%" })).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2);
  });

  it("shows a hint instead of panels when nothing is selected", async () => {
    const user = userEvent.setup();
    renderChart();

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    await waitFor(() => {
      expect(screen.getByText("Select a metric to plot")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select all" })).toBeInTheDocument();
    });
  });
});
