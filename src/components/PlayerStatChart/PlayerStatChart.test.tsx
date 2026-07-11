import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { CumulativePoint } from "@/lib/stats/cumulative";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import { PlayerStatChart } from "./PlayerStatChart";

afterEach(cleanup);

const buildSeries = (): CumulativePoint[] =>
  [1, 2, 3, 4, 5].map((gameIndex) => ({
    gameIndex,
    gameDate: new Date(2026, 0, gameIndex).toISOString(),
    matchup: `vs. OPP${gameIndex}`,
    winLoss: gameIndex % 2 === 0 ? "L" : "W",
    min: 30 + gameIndex,
    pts: 20 + gameIndex,
    reb: 5 + gameIndex,
    ast: 4 + gameIndex,
    stl: 1 + gameIndex * 0.1,
    blk: 0.5 + gameIndex * 0.1,
    tov: 2 + gameIndex * 0.1,
    fgPct: 45 + gameIndex,
    fg3Pct: 35 + gameIndex,
    ftPct: 80 + gameIndex,
  }));

describe("PlayerStatChart", () => {
  it("renders a chip per stat with every stat pressed by default", () => {
    render(
      <ThemeProvider>
        <PlayerStatChart series={buildSeries()} mode="avg" />
      </ThemeProvider>,
    );

    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(10);

    const pressedCount = chips.filter(
      (chip) => chip.getAttribute("aria-pressed") === "true",
    ).length;

    expect(pressedCount).toBe(10);
  });

  it("renders every line and both panels by default", () => {
    const { container } = render(
      <ThemeProvider>
        <PlayerStatChart series={buildSeries()} mode="avg" />
      </ThemeProvider>,
    );

    expect(container.querySelectorAll(".recharts-line")).toHaveLength(10);
    expect(screen.getByText("Shooting percentages")).toBeInTheDocument();
  });

  it("removes a line per toggled-off stat and hides the shooting panel when its stats are off", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ThemeProvider>
        <PlayerStatChart series={buildSeries()} mode="avg" />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "TOV" }));

    expect(container.querySelectorAll(".recharts-line")).toHaveLength(9);

    await user.click(screen.getByRole("button", { name: "FG%" }));
    await user.click(screen.getByRole("button", { name: "3P%" }));
    await user.click(screen.getByRole("button", { name: "FT%" }));

    expect(screen.queryByText("Shooting percentages")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(6);
  });

  it("shows a muted hint instead of a chart when every counting stat is toggled off", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <PlayerStatChart series={buildSeries()} mode="avg" />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "PTS" }));
    await user.click(screen.getByRole("button", { name: "REB" }));
    await user.click(screen.getByRole("button", { name: "AST" }));
    await user.click(screen.getByRole("button", { name: "STL" }));
    await user.click(screen.getByRole("button", { name: "BLK" }));
    await user.click(screen.getByRole("button", { name: "MIN" }));
    await user.click(screen.getByRole("button", { name: "TOV" }));

    expect(screen.getByText("Select a stat to plot")).toBeInTheDocument();
  });

  it("titles the counting panel per mode", () => {
    const { rerender } = render(
      <ThemeProvider>
        <PlayerStatChart series={buildSeries()} mode="avg" />
      </ThemeProvider>,
    );
    expect(screen.getByText("Per-game averages")).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <PlayerStatChart series={buildSeries()} mode="totals" />
      </ThemeProvider>,
    );
    expect(screen.getByText("Accumulating totals")).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <PlayerStatChart series={buildSeries()} mode="per36" />
      </ThemeProvider>,
    );
    expect(screen.getByText("Per 36 minutes")).toBeInTheDocument();
  });

  it("disables the MIN chip and drops its line in per36 mode", () => {
    const { container } = render(
      <ThemeProvider>
        <PlayerStatChart series={buildSeries()} mode="per36" />
      </ThemeProvider>,
    );

    const minChip = screen.getByRole("button", { name: "MIN" });
    expect(minChip).toBeDisabled();
    expect(minChip).toHaveAttribute("aria-pressed", "false");
    // 10 stats minus the excluded MIN line
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(9);
  });

  it("gives each chip a color dot matching its stat's permanent color", () => {
    render(
      <ThemeProvider>
        <PlayerStatChart series={buildSeries()} mode="avg" />
      </ThemeProvider>,
    );

    const ptsChip = screen.getByRole("button", { name: "PTS" });
    const dot = ptsChip.querySelector("span");

    expect(dot).toHaveStyle({ backgroundColor: "#3987e5" });
  });
});
