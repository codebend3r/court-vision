import { describe, expect, it } from "vitest";

import { aggregateWindowLogs, type WindowLog } from "@/lib/valuation/aggregate";

const log = (overrides: Partial<WindowLog> = {}): WindowLog => ({
  minutes: 30,
  pts: 20,
  reb: 5,
  ast: 4,
  stl: 1,
  blk: 1,
  fg3m: 2,
  tov: 3,
  fgm: 8,
  fga: 16,
  ftm: 2,
  fta: 3,
  ...overrides,
});

describe("aggregateWindowLogs", () => {
  it("sums stat totals across the window", () => {
    const totals = aggregateWindowLogs({ logs: [log(), log({ pts: 30, fga: 20 })] });
    expect(totals.pts).toBe(50);
    expect(totals.fga).toBe(36);
    expect(totals.minutes).toBe(60);
    expect(totals.gamesPlayed).toBe(2);
  });

  it("accumulates second moments for variance reconstruction", () => {
    const totals = aggregateWindowLogs({ logs: [log(), log({ pts: 30, fgm: 10, fga: 20 })] });
    expect(totals.sq.pts).toBe(20 * 20 + 30 * 30);
    expect(totals.sq.fga).toBe(16 * 16 + 20 * 20);
    expect(totals.cross.fg).toBe(8 * 16 + 10 * 20);
    expect(totals.cross.ft).toBe(2 * 3 + 2 * 3);
  });

  it("does not count DNPs (0 minutes) as appearances but keeps their zeros", () => {
    const totals = aggregateWindowLogs({
      logs: [log(), log({ minutes: 0, pts: 0, fgm: 0, fga: 0 })],
    });
    expect(totals.gamesPlayed).toBe(1);
    expect(totals.pts).toBe(20);
  });

  it("returns a zeroed line for an empty window", () => {
    const totals = aggregateWindowLogs({ logs: [] });
    expect(totals.gamesPlayed).toBe(0);
    expect(totals.pts).toBe(0);
    expect(totals.fta).toBe(0);
  });
});
