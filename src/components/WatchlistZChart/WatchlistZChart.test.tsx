import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { buildRows, WatchlistZChart } from "@/components/WatchlistZChart/WatchlistZChart";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { type ZTrendSeries } from "@/lib/watchlist/zTrend";

afterEach(cleanup);

const series = ({
  playerId,
  fullName,
  pointCount,
}: {
  playerId: number;
  fullName: string;
  pointCount: number;
}): ZTrendSeries => ({
  playerId,
  fullName,
  points: Array.from({ length: pointCount }, (_, index) => ({
    date: Date.UTC(2026, 0, index + 1),
    z: index * 0.1,
  })),
});

const renderChart = ({ entries }: { entries: ZTrendSeries[] }) =>
  render(
    <ThemeProvider>
      <WatchlistZChart series={entries} />
    </ThemeProvider>,
  );

describe("WatchlistZChart", () => {
  it("invites starring when there is nothing to plot", () => {
    renderChart({ entries: [] });
    expect(screen.getByText(/Star players to track/)).toBeInTheDocument();
  });

  it("names every series in the legend", () => {
    renderChart({
      entries: [
        series({ playerId: 1, fullName: "Jalen Brunson", pointCount: 12 }),
        series({ playerId: 2, fullName: "Karl-Anthony Towns", pointCount: 12 }),
      ],
    });
    expect(screen.getByText("Jalen Brunson")).toBeInTheDocument();
    expect(screen.getByText("Karl-Anthony Towns")).toBeInTheDocument();
  });

  it("flags a player without a full window instead of drawing a stub", () => {
    renderChart({
      entries: [
        series({ playerId: 1, fullName: "Jalen Brunson", pointCount: 12 }),
        series({ playerId: 2, fullName: "Rookie Guy", pointCount: 0 }),
      ],
    });
    expect(screen.getByText(/fewer than 10 games/)).toBeInTheDocument();
  });

  it("explains an all-empty chart rather than rendering bare axes", () => {
    renderChart({ entries: [series({ playerId: 2, fullName: "Rookie Guy", pointCount: 0 })] });
    expect(screen.getByText(/No starred player has 10 games yet/)).toBeInTheDocument();
  });

  it("captions what the number means", () => {
    renderChart({ entries: [series({ playerId: 1, fullName: "Jalen Brunson", pointCount: 12 })] });
    expect(screen.getByText(/Zero is league-average value/)).toBeInTheDocument();
  });
});

describe("buildRows", () => {
  const day = (n: number) => Date.UTC(2026, 0, n);

  it("emits one row per distinct date, in order", () => {
    const rows = buildRows({
      series: [
        {
          playerId: 1,
          fullName: "A A",
          points: [
            { date: day(3), z: 1 },
            { date: day(1), z: 2 },
          ],
        },
        { playerId: 2, fullName: "B B", points: [{ date: day(2), z: 3 }] },
      ],
    });
    expect(rows.map((row) => row.date)).toEqual([day(1), day(2), day(3)]);
  });

  it("leaves a player undefined on dates they did not play", () => {
    const rows = buildRows({
      series: [
        { playerId: 1, fullName: "A A", points: [{ date: day(1), z: 1 }] },
        { playerId: 2, fullName: "B B", points: [{ date: day(2), z: 3 }] },
      ],
    });
    expect(rows[0]?.p1).toBe(1);
    expect(rows[0]?.p2).toBeUndefined();
    expect(rows[1]?.p2).toBe(3);
  });

  it("collapses a shared date into a single row", () => {
    const rows = buildRows({
      series: [
        { playerId: 1, fullName: "A A", points: [{ date: day(1), z: 1 }] },
        { playerId: 2, fullName: "B B", points: [{ date: day(1), z: 2 }] },
      ],
    });
    // One row per date is what lets the x-axis be a category scale, which is
    // what spaces the dates evenly.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ date: day(1), p1: 1, p2: 2 });
  });
});
