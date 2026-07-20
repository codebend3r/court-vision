import { describe, expect, it } from "vitest";

import {
  gamesForSpan,
  loadStatFilters,
  resolveSeasonSelection,
  SEASON_OPTIONS,
} from "@/lib/stats/searchParams";

describe("loadStatFilters", () => {
  it("falls back to defaults when params are absent", async () => {
    const result = await loadStatFilters({});

    expect(result).toEqual({ mode: "game", span: "season", season: null });
  });

  it("parses valid mode and span literals", async () => {
    const result = await loadStatFilters({ mode: "totals", span: "10" });

    expect(result).toEqual({ mode: "totals", span: "10", season: null });
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

    expect(result).toEqual({ mode: "game", span: "season", season: null });
  });

  it("falls back to defaults on array values", async () => {
    const result = await loadStatFilters({ mode: ["totals", "per36"], span: ["10", "20"] });

    expect(result).toEqual({ mode: "totals", span: "10", season: null });
  });

  it("parses every known season label and the career sentinel", async () => {
    expect((await loadStatFilters({ season: "2025-26" })).season).toBe("2025-26");
    expect((await loadStatFilters({ season: "2020-21" })).season).toBe("2020-21");
    expect((await loadStatFilters({ season: "career" })).season).toBe("career");
  });

  it("rejects seasons outside the backfill window", async () => {
    expect((await loadStatFilters({ season: "2019-20" })).season).toBeNull();
    expect((await loadStatFilters({ season: "bogus" })).season).toBeNull();
  });
});

describe("SEASON_OPTIONS", () => {
  it("lists every backfilled season newest first", () => {
    expect(SEASON_OPTIONS[0]).toBe("2025-26");
    expect(SEASON_OPTIONS[SEASON_OPTIONS.length - 1]).toBe("2020-21");
    expect(SEASON_OPTIONS).toHaveLength(6);
  });
});

describe("resolveSeasonSelection", () => {
  it("honors an explicit request over the player's seasons", () => {
    expect(
      resolveSeasonSelection({ requested: "2021-22", playerSeasons: ["2025-26", "2024-25"] }),
    ).toBe("2021-22");
    expect(resolveSeasonSelection({ requested: "career", playerSeasons: ["2025-26"] })).toBe(
      "career",
    );
  });

  it("defaults to the player's most recent season with data", () => {
    expect(resolveSeasonSelection({ requested: null, playerSeasons: ["2023-24", "2022-23"] })).toBe(
      "2023-24",
    );
  });

  it("falls back to the current league season when the player has none", () => {
    expect(resolveSeasonSelection({ requested: null, playerSeasons: [] })).toBe("2025-26");
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
