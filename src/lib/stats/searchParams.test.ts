import { describe, expect, it } from "vitest";

import { gamesForSpan, loadStatFilters } from "@/lib/stats/searchParams";

describe("loadStatFilters", () => {
  it("falls back to defaults when params are absent", async () => {
    const result = await loadStatFilters({});

    expect(result).toEqual({ mode: "avg", span: "season" });
  });

  it("parses valid mode and span literals", async () => {
    const result = await loadStatFilters({ mode: "totals", span: "10" });

    expect(result).toEqual({ mode: "totals", span: "10" });
  });

  it("parses per36 mode and every game-count span", async () => {
    expect((await loadStatFilters({ mode: "per36" })).mode).toBe("per36");
    expect((await loadStatFilters({ span: "5" })).span).toBe("5");
    expect((await loadStatFilters({ span: "20" })).span).toBe("20");
    expect((await loadStatFilters({ span: "40" })).span).toBe("40");
    expect((await loadStatFilters({ span: "60" })).span).toBe("60");
    expect((await loadStatFilters({ span: "season" })).span).toBe("season");
  });

  it("parses game mode for raw per-game chart values", async () => {
    expect((await loadStatFilters({ mode: "game" })).mode).toBe("game");
  });

  it("falls back to defaults on invalid values", async () => {
    const result = await loadStatFilters({ mode: "bogus", span: "15" });

    expect(result).toEqual({ mode: "avg", span: "season" });
  });

  it("falls back to defaults on array values", async () => {
    const result = await loadStatFilters({ mode: ["totals", "per36"], span: ["10", "20"] });

    expect(result).toEqual({ mode: "totals", span: "10" });
  });
});

describe("gamesForSpan", () => {
  it("maps game-count spans to numbers", () => {
    expect(gamesForSpan({ span: "5" })).toBe(5);
    expect(gamesForSpan({ span: "10" })).toBe(10);
    expect(gamesForSpan({ span: "20" })).toBe(20);
    expect(gamesForSpan({ span: "40" })).toBe(40);
    expect(gamesForSpan({ span: "60" })).toBe(60);
  });

  it("maps season to null (no window)", () => {
    expect(gamesForSpan({ span: "season" })).toBeNull();
  });
});
