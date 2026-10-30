import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "bun:test";

import {
  FantasyValueTrends,
  TrendTooltip,
  type FantasyTrendRow,
} from "@/components/FantasyValueTrends/FantasyValueTrends";
import { ThemeProvider } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type FantasyTrendValue } from "@vision/core/valuation/trend";

afterEach(cleanup);

// Games 71 to 82 of a season: the first nine wait for the window, the last
// three (games 80, 81, 82) score.
type FilledTrendProps = { peak: number };

const filledTrend = ({ peak }: FilledTrendProps): FantasyTrendValue[] =>
  Array.from({ length: 12 }, (_, index) => ({
    gameIndex: index + 1,
    gameNumber: index + 71,
    gameDate: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    dnp: false,
    z: index < 9 ? null : peak - (11 - index),
    g: index < 9 ? null : (peak - (11 - index)) * 0.8,
    points: index < 9 ? null : 30 + (peak - (11 - index)) * 4,
    vorp: index < 9 ? null : peak - (11 - index) - 1,
    positional: index < 9 ? null : peak - (11 - index) - 0.5,
    sgp: index < 9 ? null : (peak - (11 - index)) / 2,
    sim: index < 9 ? null : (peak - (11 - index)) / 10,
  }));

const COLORS = {
  z: "#000",
  g: "#111",
  points: "#222",
  vorp: "#333",
  positional: "#444",
  sgp: "#555",
  sim: "#666",
};

type RowProps = {
  playerId: number;
  z: number;
  rank: number;
  trend: FantasyTrendValue[];
};

const row = ({ playerId, z, rank, trend }: RowProps): FantasyTrendRow => ({
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

// The charts read which methods show and the average switch from the URL.
type RenderTrendsUrlProps = { searchParams?: string; onUrlUpdate?: () => void };

const renderTrends = (
  overrides: Partial<Parameters<typeof FantasyValueTrends>[0]> = {},
  { searchParams = "", onUrlUpdate = vi.fn() }: RenderTrendsUrlProps = {},
) =>
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
    { wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate }) },
  );

describe("FantasyValueTrends", () => {
  it("draws all seven method sparklines for every row with games", () => {
    const { container } = renderTrends();

    const list = screen.getByRole("list", { name: "Players" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(rows.length);
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2 * 7);
  });

  it("explains a row with too few games instead of drawing it", () => {
    renderTrends();

    expect(screen.getByText(/No games this season/i)).toBeInTheDocument();
  });

  it("states the window once in the header and labels each method column", () => {
    renderTrends();

    expect(screen.getByText(/over each player's last 20 games/)).toBeInTheDocument();
    // Each method names its column once in the header, beside its toggle.
    expect(screen.getAllByText("Sim Value")).toHaveLength(2);
    expect(screen.getAllByText("PL Linear")).toHaveLength(2);
  });

  it("reads the whole season when no window is set", () => {
    renderTrends({ windowGames: null });

    expect(screen.getByText(/over this season/)).toBeInTheDocument();
  });

  it("labels each row with the season games it plots, from the first one with a value", () => {
    renderTrends();

    expect(screen.getAllByText("Game 80")).toHaveLength(2);
    expect(screen.getAllByText("Game 82")).toHaveLength(2);
    expect(screen.queryByText("Game 71")).not.toBeInTheDocument();
  });

  it("starts every line at the left edge rather than after the empty lead-in", () => {
    const { container } = renderTrends();

    // Seven sparklines for each of the two rows with games.
    const paths = [...container.querySelectorAll(".recharts-line-curve")];
    expect(paths).toHaveLength(14);
    paths.forEach((path) => expect(path.getAttribute("d") ?? "").toMatch(/^M0,/));
  });

  it("names every chart for assistive tech with its latest values", () => {
    renderTrends();

    expect(screen.getByRole("img", { name: /Test Player 1 rolling value/ })).toHaveAttribute(
      "aria-label",
      expect.stringContaining("latest Z-Score +3.5, G-Score +2.8, PL Linear +44.0"),
    );
    expect(screen.getByRole("img", { name: /Test Player 1 rolling value/ })).toHaveAttribute(
      "aria-label",
      expect.stringContaining("games 80 to 82"),
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

  it("draws only the methods left on, and wires the controls", async () => {
    const onUrlUpdate = vi.fn();
    const onSpan = vi.fn();
    const { container } = renderTrends(
      {
        span: "season",
        onSpan,
        // The league's average on each of the fixture's game dates, rising.
        averages: Array.from({ length: 12 }, (_, index) => ({
          date: Date.UTC(2026, 0, index + 1),
          values: { z: index / 10, g: 0, points: 25, vorp: 0, positional: 0, sgp: 0, sim: 0 },
        })),
      },
      { searchParams: "?hide=g,points,vorp,positional,sgp", onUrlUpdate },
    );

    // Z and Sim Value for each of the two rows with games, each over its
    // dotted league-average line.
    expect(container.querySelectorAll(".recharts-line-curve")).toHaveLength(8);
    expect(container.querySelectorAll('.recharts-line-curve[stroke-dasharray="3 3"]')).toHaveLength(
      4,
    );
    const charts = within(screen.getByRole("group", { name: "Charts shown" }));
    expect(charts.getAllByRole("button", { pressed: true })).toHaveLength(2);
    charts.getByRole("button", { name: "Sim Value" }).click();
    await waitFor(() =>
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ queryString: "?hide=g,points,vorp,positional,sgp,sim" }),
      ),
    );
    within(screen.getByRole("group", { name: "Timeframe" }))
      .getByRole("button", { name: "Last 5" })
      .click();
    expect(onSpan).toHaveBeenCalledWith("5");
    expect(screen.getByRole("checkbox", { name: "League average" })).toBeChecked();
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
        colors={COLORS}
      />,
    );

    expect(screen.getByText(/^Game 82 ·/)).toBeInTheDocument();
    expect(screen.getByText("Z-Score: +3.5")).toBeInTheDocument();
    expect(screen.queryByText(/DNP/)).not.toBeInTheDocument();
  });

  it("dashes a missing score and flags a missed game", () => {
    const missed: FantasyTrendValue = {
      gameIndex: 1,
      gameNumber: 40,
      gameDate: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      dnp: true,
      z: null,
      g: -0.25,
      points: null,
      vorp: null,
      positional: null,
      sgp: null,
      sim: null,
    };
    render(
      <TrendTooltip
        active
        payload={[{ payload: missed, graphicalItemId: "z" }]}
        trend={[missed]}
        colors={COLORS}
      />,
    );

    expect(screen.getByText("Z-Score: —")).toBeInTheDocument();
    expect(screen.getByText("G-Score: -0.3")).toBeInTheDocument();
    expect(screen.getByText("DNP / DNP-CD (0 MIN)")).toBeInTheDocument();
  });
});
