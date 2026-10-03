import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import {
  breakdownDomain,
  FantasyValueCharts,
  type FantasyChartRow,
} from "@/components/FantasyValueCharts/FantasyValueCharts";
import { type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";
import { CATEGORY_META } from "@vision/sport-basketball/engine";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

afterEach(cleanup);

// Every category scores the same z so a row's extent is easy to reason about.
const breakdownAt = ({ z }: { z: number }): FantasyCategoryBreakdown[] =>
  CATEGORY_META.map((meta) => ({
    key: meta.key,
    label: meta.label,
    fullName: meta.fullName,
    kind: meta.kind,
    perGame: 10,
    z,
    g: z * 0.8,
  }));

const row = ({
  playerId,
  z,
  rank,
}: {
  playerId: number;
  z: number;
  rank: number;
}): FantasyChartRow => ({
  ...makeStatLine({ playerId }),
  rank,
  values: { playerId, z, g: z * 0.8, points: 40, vorp: z, positional: z, sgp: z, sim: z },
  breakdown: breakdownAt({ z }),
});

const rows = [row({ playerId: 1, z: 2.4, rank: 1 }), row({ playerId: 2, z: -1.2, rank: 2 })];

const renderCharts = (overrides: Partial<Parameters<typeof FantasyValueCharts>[0]> = {}) =>
  render(
    <ThemeProvider>
      <FantasyValueCharts
        rows={rows}
        categories={CATEGORY_META}
        sort="z"
        dir="desc"
        isSignedIn={false}
        onSort={vi.fn()}
        {...overrides}
      />
    </ThemeProvider>,
  );

describe("FantasyValueCharts", () => {
  it("draws a Z and a G bar for every category on every player's row", () => {
    const { container } = renderCharts();

    const items = within(screen.getByRole("list", { name: "Fantasy value charts" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(rows.length);
    expect(container.querySelectorAll(".recharts-bar")).toHaveLength(rows.length * 2);
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(
      rows.length * CATEGORY_META.length * 2,
    );
  });

  it("links each row to the player's page", () => {
    renderCharts();

    expect(screen.getByRole("link", { name: "Test Player 1" })).toHaveAttribute(
      "href",
      "/players/1",
    );
    expect(screen.getByRole("link", { name: "Test Player 2" })).toHaveAttribute(
      "href",
      "/players/2",
    );
  });

  it("labels the category bands once in the header rather than under every row", () => {
    renderCharts();

    expect(screen.getAllByText("PTS")).toHaveLength(1);
    expect(screen.getAllByText("FT%")).toHaveLength(1);
  });

  it("names every chart for assistive tech with its scores", () => {
    renderCharts();

    const chart = screen.getByRole("img", { name: /Test Player 1 category breakdown/ });
    expect(chart).toHaveAttribute("aria-label", expect.stringContaining("PTS Z +2.4 G +1.9"));
  });

  it("keeps the charts out of the tab order", () => {
    renderCharts();

    const list = screen.getByRole("list", { name: "Fantasy value charts" });
    expect(list.querySelectorAll("svg[tabindex]")).toHaveLength(0);
    expect(list.querySelectorAll('[role="application"]')).toHaveLength(0);
  });

  it("prints the Z and G readouts, flagging negatives", () => {
    renderCharts();

    expect(screen.getByText("+2.4")).not.toHaveAttribute("data-negative");
    expect(screen.getByText("-1.2")).toHaveAttribute("data-negative", "true");
  });

  it("sorts by Z or G from the readout headers", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    renderCharts({ onSort });

    expect(screen.getByRole("button", { name: /Z-Score/ })).toHaveAttribute("data-active", "true");
    await user.click(screen.getByRole("button", { name: /G-Score/ }));
    expect(onSort).toHaveBeenCalledWith({ sort: "g" });
  });

  it("shows the rank only under a stat sort", () => {
    const { rerender } = renderCharts();
    expect(screen.getByText("1")).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <FantasyValueCharts
          rows={rows}
          categories={CATEGORY_META}
          sort="lastName"
          dir="asc"
          isSignedIn={false}
          onSort={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("adds a star control per row only when signed in", () => {
    const { rerender } = renderCharts();
    expect(screen.queryByRole("button", { name: /^Star / })).not.toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <FantasyValueCharts
          rows={rows}
          categories={CATEGORY_META}
          sort="z"
          dir="desc"
          isSignedIn
          onSort={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.getAllByRole("button", { name: /^Star / })).toHaveLength(rows.length);
  });
});

describe("breakdownDomain", () => {
  it("is symmetric around zero at the page's widest score", () => {
    expect(breakdownDomain({ rows })).toEqual([-2.4, 2.4]);
  });

  it("keeps one standard deviation of headroom for a page of average players", () => {
    expect(breakdownDomain({ rows: [row({ playerId: 3, z: 0.2, rank: 1 })] })).toEqual([-1, 1]);
  });
});
