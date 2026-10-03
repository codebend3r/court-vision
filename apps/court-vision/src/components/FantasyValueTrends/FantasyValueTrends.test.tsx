import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "bun:test";

import {
  FantasyValueTrends,
  trendDomain,
  TrendTooltip,
  type FantasyTrendRow,
} from "@/components/FantasyValueTrends/FantasyValueTrends";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type FantasyTrendValue } from "@vision/core/valuation/trend";

afterEach(cleanup);

// Games 71 to 82 of a season: the first nine wait for the window, the last
// three (games 80, 81, 82) score.
const filledTrend = ({ peak }: { peak: number }): FantasyTrendValue[] =>
  Array.from({ length: 12 }, (_, index) => ({
    gameIndex: index + 1,
    gameNumber: index + 71,
    gameDate: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    dnp: false,
    z: index < 9 ? null : peak - (11 - index),
    g: index < 9 ? null : (peak - (11 - index)) * 0.8,
  }));

const row = ({
  playerId,
  z,
  rank,
  trend,
}: {
  playerId: number;
  z: number;
  rank: number;
  trend: FantasyTrendValue[];
}): FantasyTrendRow => ({
  ...makeStatLine({ playerId }),
  rank,
  values: { playerId, z, g: z * 0.8, points: 40, vorp: z, positional: z, sgp: z, sim: z },
  trend,
});

const rows = [
  row({ playerId: 1, z: 2.4, rank: 1, trend: filledTrend({ peak: 3.5 }) }),
  row({ playerId: 2, z: -1.2, rank: 2, trend: filledTrend({ peak: -0.5 }) }),
  row({ playerId: 3, z: 0.3, rank: 3, trend: [] }),
];

const renderTrends = (overrides: Partial<Parameters<typeof FantasyValueTrends>[0]> = {}) =>
  render(
    <ThemeProvider>
      <FantasyValueTrends
        rows={rows}
        status="ready"
        windowGames={20}
        sort="z"
        dir="desc"
        isSignedIn={false}
        onSort={vi.fn()}
        {...overrides}
      />
    </ThemeProvider>,
  );

describe("FantasyValueTrends", () => {
  it("draws a Z and a G line for every row whose window has filled", () => {
    const { container } = renderTrends();

    const list = screen.getByRole("list", { name: "Fantasy value trends" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(rows.length);
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2 * 2);
  });

  it("explains a row with too few games instead of drawing it", () => {
    renderTrends();

    expect(screen.getByText(/needs 10 games/i)).toBeInTheDocument();
  });

  it("states the window once in the header", () => {
    renderTrends();

    expect(screen.getByText("Last 20 games")).toBeInTheDocument();
    expect(screen.getByText(/over each player's last 20 games/)).toBeInTheDocument();
  });

  it("labels each row with the season games it plots, from the first one with a value", () => {
    renderTrends();

    expect(screen.getAllByText("Game 80")).toHaveLength(2);
    expect(screen.getAllByText("Game 82")).toHaveLength(2);
    expect(screen.queryByText("Game 71")).not.toBeInTheDocument();
  });

  it("starts every line at the left edge rather than after the empty lead-in", () => {
    const { container } = renderTrends();

    const paths = [...container.querySelectorAll(".recharts-line-curve")];
    expect(paths).toHaveLength(4);
    paths.forEach((path) => expect(path.getAttribute("d") ?? "").toMatch(/^M0,/));
  });

  it("names every chart for assistive tech with its latest values", () => {
    renderTrends();

    expect(screen.getByRole("img", { name: /Test Player 1 rolling value/ })).toHaveAttribute(
      "aria-label",
      expect.stringContaining("latest Z +3.5, G +2.8, games 80 to 82"),
    );
    expect(screen.getByRole("img", { name: /Test Player 3 rolling value/ })).toHaveAttribute(
      "aria-label",
      expect.stringContaining("not available"),
    );
  });

  it("shows placeholders while the game logs load", () => {
    const { container } = renderTrends({
      status: "loading",
      rows: rows.map((entry) => ({ ...entry, trend: [] })),
    });

    expect(screen.getAllByText(/loading rolling value/i)).toHaveLength(rows.length);
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(0);
    expect(screen.getByRole("region", { name: "Fantasy value trends" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("announces a failed load", () => {
    renderTrends({ status: "error", rows: rows.map((entry) => ({ ...entry, trend: [] })) });

    expect(screen.getByRole("alert")).toHaveTextContent(/game logs/i);
  });
});

describe("TrendTooltip", () => {
  it("names the hovered point by its game in the season", () => {
    const trend = filledTrend({ peak: 3.5 });
    const last = trend[11];
    if (last === undefined) throw new Error("fixture has no game 82");
    render(
      <TrendTooltip
        active
        payload={[{ payload: last, graphicalItemId: "z" }]}
        trend={trend}
        colors={{ z: "#000", g: "#111" }}
      />,
    );

    expect(screen.getByText(/^Game 82 ·/)).toBeInTheDocument();
    expect(screen.getByText("Z-Score: +3.5")).toBeInTheDocument();
  });
});

describe("trendDomain", () => {
  it("is symmetric around zero at the page's widest rolling value", () => {
    expect(trendDomain({ rows })).toEqual([-3.5, 3.5]);
  });

  it("keeps one standard deviation of headroom for a flat page", () => {
    expect(trendDomain({ rows: [row({ playerId: 9, z: 0, rank: 1, trend: [] })] })).toEqual([
      -1, 1,
    ]);
  });
});
