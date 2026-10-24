import { describe, expect, it } from "bun:test";

import { buildRosterCharts } from "@/lib/roster/charts";
import { type StatSpec } from "@/lib/roster/compare";

type Row = { id: number; lastName: string; fullName: string; games: number; pts: number };

const row = ({ id, games, pts }: { id: number; games: number; pts: number }): Row => ({
  id,
  lastName: `P${id}`,
  fullName: `A P${id}`,
  games,
  pts,
});

const points: StatSpec<Row> = {
  key: "pts",
  label: "PTS",
  fullName: "Points",
  direction: "high",
  valueOf: (entry) => entry.pts,
  format: (value) => value.toFixed(1),
};

describe("buildRosterCharts", () => {
  const pool = [
    row({ id: 1, games: 10, pts: 10 }),
    row({ id: 2, games: 10, pts: 20 }),
    row({ id: 3, games: 10, pts: 30 }),
    // One game of 90 points: under half the median games, so it can't set the bar.
    row({ id: 4, games: 1, pts: 90 }),
  ];

  it("builds one chart per stat, carrying the stat's names", () => {
    const [chart] = buildRosterCharts({
      rows: [pool[0], pool[2]].flatMap((entry) => (entry === undefined ? [] : [entry])),
      pool,
      specs: [points],
      gamesOf: (entry) => entry.games,
    });
    expect(chart).toMatchObject({ key: "pts", label: "PTS", fullName: "Points" });
  });

  it("ranks the roster best first and tiers it against qualifying players only", () => {
    const rows = pool.filter((entry) => entry.id === 1 || entry.id === 3);
    const [chart] = buildRosterCharts({ rows, pool, specs: [points], gamesOf: (e) => e.games });
    expect(chart?.bars.map((bar) => [bar.name, bar.tier])).toEqual([
      ["P3", "strong"],
      ["P1", "weak"],
    ]);
  });
});
