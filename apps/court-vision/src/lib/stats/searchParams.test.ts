import { describe, expect, it } from "bun:test";

import {
  coerceStatMode,
  gamesForSpan,
  isPlayerView,
  loadStatFilters,
  PLAYER_VIEWS,
  rangeForSpan,
  resolveSeasonSelection,
  SEASON_OPTIONS,
  spanLabel,
} from "@/lib/stats/searchParams";

describe("loadStatFilters", () => {
  it("falls back to defaults when params are absent", async () => {
    const result = await loadStatFilters({});

    expect(result).toEqual({ mode: "game", span: "season", season: null, view: "regular" });
  });

  it("parses valid mode and span literals", async () => {
    const result = await loadStatFilters({ mode: "totals", span: "10" });

    expect(result).toEqual({ mode: "totals", span: "10", season: null, view: "regular" });
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

    expect(result).toEqual({ mode: "game", span: "season", season: null, view: "regular" });
  });

  it("falls back to defaults on array values", async () => {
    const result = await loadStatFilters({ mode: ["totals", "per36"], span: ["10", "20"] });

    expect(result).toEqual({ mode: "totals", span: "10", season: null, view: "regular" });
  });

  it("parses each player view and falls back to regular", async () => {
    expect((await loadStatFilters({ view: "advanced" })).view).toBe("advanced");
    expect((await loadStatFilters({ view: "fantasy" })).view).toBe("fantasy");
    expect((await loadStatFilters({ view: "regular" })).view).toBe("regular");
    expect((await loadStatFilters({ view: "starred" })).view).toBe("regular");
  });

  it("parses every known season label and the career sentinel", async () => {
    expect((await loadStatFilters({ season: "2025-26" })).season).toBe("2025-26");
    expect((await loadStatFilters({ season: "2020-21" })).season).toBe("2020-21");
    expect((await loadStatFilters({ season: "2019-20" })).season).toBe("2019-20");
    expect((await loadStatFilters({ season: "2016-17" })).season).toBe("2016-17");
    expect((await loadStatFilters({ season: "career" })).season).toBe("career");
  });

  it("rejects seasons outside the backfill window", async () => {
    expect((await loadStatFilters({ season: "2015-16" })).season).toBeNull();
    expect((await loadStatFilters({ season: "bogus" })).season).toBeNull();
  });
});

describe("SEASON_OPTIONS", () => {
  it("lists every backfilled season newest first", () => {
    expect(SEASON_OPTIONS[0]).toBe("2026-27");
    expect(SEASON_OPTIONS[SEASON_OPTIONS.length - 1]).toBe("2016-17");
    expect(SEASON_OPTIONS).toHaveLength(11);
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
    expect(resolveSeasonSelection({ requested: null, playerSeasons: [] })).toBe("2026-27");
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

describe("PLAYER_VIEWS / isPlayerView", () => {
  it("lists the three player views in tab order", () => {
    expect(PLAYER_VIEWS).toEqual(["regular", "advanced", "fantasy"]);
  });

  it("guards arbitrary strings", () => {
    expect(isPlayerView("advanced")).toBe(true);
    expect(isPlayerView("fantasy")).toBe(true);
    expect(isPlayerView("regular")).toBe(true);
    expect(isPlayerView("starred")).toBe(false);
    expect(isPlayerView("")).toBe(false);
    expect(isPlayerView(undefined)).toBe(false);
  });
});

describe("coerceStatMode", () => {
  it("keeps a mode the view offers", () => {
    expect(coerceStatMode({ mode: "game", modes: ["game", "avg"] })).toBe("game");
    expect(coerceStatMode({ mode: "per36", modes: ["game", "avg", "totals", "per36"] })).toBe(
      "per36",
    );
  });

  it("falls back to avg when the view cannot plot the requested mode", () => {
    expect(coerceStatMode({ mode: "totals", modes: ["game", "avg"] })).toBe("avg");
    expect(coerceStatMode({ mode: "per36", modes: ["game", "avg"] })).toBe("avg");
  });

  it("falls back to the first offered mode when avg is not offered", () => {
    expect(coerceStatMode({ mode: "totals", modes: ["game"] })).toBe("game");
  });

  it("falls back to the default mode when the view offers none", () => {
    expect(coerceStatMode({ mode: "totals", modes: [] })).toBe("game");
  });
});

describe("rangeForSpan", () => {
  it("maps each timeframe onto the players-list game range", () => {
    expect(rangeForSpan({ span: "5" })).toBe("last5");
    expect(rangeForSpan({ span: "10" })).toBe("last10");
    expect(rangeForSpan({ span: "20" })).toBe("last20");
    expect(rangeForSpan({ span: "40" })).toBe("last40");
    expect(rangeForSpan({ span: "60" })).toBe("last60");
    expect(rangeForSpan({ span: "season" })).toBe("all");
  });
});

describe("spanLabel", () => {
  it("names the window the way the Fantasy tab does", () => {
    expect(spanLabel({ span: "5" })).toBe("Last 5 games");
    expect(spanLabel({ span: "60" })).toBe("Last 60 games");
    expect(spanLabel({ span: "season" })).toBe("All games");
  });
});
