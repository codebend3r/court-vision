import { describe, expect, it, vi } from "bun:test";

import { type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";

import { cachedBreakdownFor } from "@/lib/advisor/breakdown";
import { makeStatLine } from "@/lib/valuation/fixtures";

const breakdown: FantasyCategoryBreakdown[] = [
  { key: "pts", label: "PTS", fullName: "Points", kind: "counting", perGame: 20, z: 1, g: 1 },
];

describe("cachedBreakdownFor", () => {
  it("works a player's breakdown out once and reuses it", () => {
    const lineBreakdown = vi.fn(() => breakdown);
    const breakdownFor = cachedBreakdownFor({
      lines: [makeStatLine({ playerId: 1 })],
      lineBreakdown,
    });

    expect(breakdownFor({ playerId: 1 })).toEqual(breakdown);
    breakdownFor({ playerId: 1 });
    expect(lineBreakdown).toHaveBeenCalledTimes(1);
  });

  it("reads an unknown player as no categories", () => {
    const lineBreakdown = vi.fn(() => breakdown);
    expect(cachedBreakdownFor({ lines: [], lineBreakdown })({ playerId: 9 })).toEqual([]);
    expect(lineBreakdown).not.toHaveBeenCalled();
  });
});
