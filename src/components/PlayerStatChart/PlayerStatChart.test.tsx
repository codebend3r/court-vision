import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withNuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it } from "vitest";

import type { CumulativePoint } from "@/lib/stats/cumulative";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";

afterEach(cleanup);

const buildSeries = (): CumulativePoint[] =>
  [1, 2, 3, 4, 5].map((gameIndex) => ({
    gameIndex,
    gameDate: new Date(2026, 0, gameIndex).toISOString(),
    matchup: `vs. OPP${gameIndex}`,
    winLoss: gameIndex % 2 === 0 ? "L" : "W",
    dnp: gameIndex === 3,
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

const renderChart = ({
  mode = "avg",
  searchParams = {},
  onUrlUpdate,
}: {
  mode?: "avg" | "game" | "totals" | "per36";
  searchParams?: Record<string, string>;
  onUrlUpdate?: (event: UrlUpdateEvent) => void;
} = {}) =>
  render(
    <ThemeProvider>
      <PlayerStatChart series={buildSeries()} mode={mode} />
    </ThemeProvider>,
    { wrapper: withNuqsTestingAdapter({ hasMemory: true, onUrlUpdate, searchParams }) },
  );

describe("PlayerStatChart", () => {
  it("renders a chip per stat with every stat pressed by default", () => {
    renderChart();

    // 10 stat chips plus the bulk Clear all / Select all action.
    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(11);

    const pressedCount = chips.filter(
      (chip) => chip.getAttribute("aria-pressed") === "true",
    ).length;

    expect(pressedCount).toBe(10);
  });

  it("renders every line and both panels by default", () => {
    const { container } = renderChart();

    expect(container.querySelectorAll(".recharts-line")).toHaveLength(10);
    expect(screen.getByText("Shooting percentages")).toBeInTheDocument();
  });

  it("removes a line per toggled-off stat and hides the shooting panel when its stats are off", async () => {
    const user = userEvent.setup();
    const { container } = renderChart();

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
    renderChart();

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
    const { rerender } = renderChart();
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

    rerender(
      <ThemeProvider>
        <PlayerStatChart series={buildSeries()} mode="game" />
      </ThemeProvider>,
    );
    expect(screen.getByText("Per-game stats")).toBeInTheDocument();
  });

  it("shows only raw counting stats in game mode", () => {
    const { container } = renderChart({ mode: "game" });

    // 7 counting chips plus the bulk Clear all / Select all action.
    expect(screen.getAllByRole("button")).toHaveLength(8);
    expect(screen.queryByRole("button", { name: "FG%" })).not.toBeInTheDocument();
    expect(screen.queryByText("Shooting percentages")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(7);
  });

  it("disables the MIN chip and drops its line in per36 mode", () => {
    const { container } = renderChart({ mode: "per36" });

    const minChip = screen.getByRole("button", { name: "MIN" });
    expect(minChip).toBeDisabled();
    expect(minChip).toHaveAttribute("aria-pressed", "false");
    // 10 stats minus the excluded MIN line
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(9);
  });

  it("gives each chip an icon matching its stat's permanent color", () => {
    renderChart();

    const ptsChip = screen.getByRole("button", { name: "PTS" });
    const icon = ptsChip.querySelector("span");

    expect(icon?.querySelector("svg")).toBeInTheDocument();
    expect(icon).toHaveStyle({ color: "#3987e5" });
  });

  it("marks zero-minute games when the DNP toggle is enabled and writes it to the URL", async () => {
    const user = userEvent.setup();
    const updates: UrlUpdateEvent[] = [];
    const { container } = renderChart({ onUrlUpdate: (event) => updates.push(event) });

    await user.click(screen.getByRole("switch", { name: "Show DNP / DNP-CD" }));

    expect(screen.getByRole("switch", { name: "Show DNP / DNP-CD" })).toBeChecked();
    expect(container.querySelectorAll("[data-dnp-marker]")).toHaveLength(2);
    expect(updates.at(-1)?.queryString).toBe("?dnp=true");
  });

  it("restores visible stats from the URL and writes each chip change back", async () => {
    const user = userEvent.setup();
    const updates: UrlUpdateEvent[] = [];
    renderChart({
      searchParams: { stats: "pts,reb" },
      onUrlUpdate: (event) => updates.push(event),
    });

    expect(screen.getByRole("button", { name: "PTS" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "AST" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "AST" }));

    expect(updates.at(-1)?.queryString).toBe("?stats=pts,reb,ast");
  });

  it("clears every stat in one click and flips the action to Select all", async () => {
    const user = userEvent.setup();
    const updates: UrlUpdateEvent[] = [];
    renderChart({ onUrlUpdate: (event) => updates.push(event) });

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(updates.at(-1)?.searchParams.get("stats")).toBe("");
    expect(screen.getByText("Select a stat to plot")).toBeInTheDocument();
    expect(screen.queryByText("Shooting percentages")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select all" })).toBeInTheDocument();
  });

  it("re-selects every visible stat in one click when everything is off", async () => {
    const user = userEvent.setup();
    const updates: UrlUpdateEvent[] = [];
    renderChart({
      searchParams: { stats: "" },
      onUrlUpdate: (event) => updates.push(event),
    });

    expect(screen.getByText("Select a stat to plot")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select all" }));

    expect(updates.at(-1)?.searchParams.get("stats")).toBe(
      "pts,reb,ast,stl,blk,min,tov,fgPct,fg3Pct,ftPct",
    );
    expect(screen.getByText("Shooting percentages")).toBeInTheDocument();
  });
});
