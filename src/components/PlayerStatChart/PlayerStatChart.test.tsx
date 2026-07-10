import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { CumulativePoint } from "@/lib/stats/cumulative";

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
  it("renders a chip per stat with only the defaults pressed", () => {
    render(<PlayerStatChart series={buildSeries()} />);

    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(10);

    const pressedLabels = chips
      .filter((chip) => chip.getAttribute("aria-pressed") === "true")
      .map((chip) => chip.textContent);

    expect(pressedLabels).toEqual(["PTS", "REB", "AST"]);
  });

  it("renders one recharts line per default-active counting stat", () => {
    const { container } = render(<PlayerStatChart series={buildSeries()} />);

    expect(container.querySelectorAll(".recharts-line")).toHaveLength(3);
  });

  it("adds a line per toggled-on stat and reveals the shooting panel on demand", async () => {
    const user = userEvent.setup();
    const { container } = render(<PlayerStatChart series={buildSeries()} />);

    expect(screen.queryByText("Shooting percentages")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "TOV" }));

    expect(container.querySelectorAll(".recharts-line")).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "FG%" }));

    expect(screen.getByText("Shooting percentages")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(5);
  });

  it("shows a muted hint instead of a chart when every counting stat is toggled off", async () => {
    const user = userEvent.setup();
    render(<PlayerStatChart series={buildSeries()} />);

    await user.click(screen.getByRole("button", { name: "PTS" }));
    await user.click(screen.getByRole("button", { name: "REB" }));
    await user.click(screen.getByRole("button", { name: "AST" }));

    expect(screen.getByText("Select a stat to plot")).toBeInTheDocument();
  });

  it("gives each chip a color dot matching its stat's permanent color", () => {
    render(<PlayerStatChart series={buildSeries()} />);

    const ptsChip = screen.getByRole("button", { name: "PTS" });
    const dot = ptsChip.querySelector("span");

    expect(dot).toHaveStyle({ backgroundColor: "#3987e5" });
  });
});
