import { describe, expect, it } from "vitest";

import { CAREER_SCOPE, resolveSeasonScope, seasonScopeValue } from "@/lib/players/seasonScope";

const SEASONS = ["2025-26", "2024-25", "2023-24"] as const;

describe("resolveSeasonScope", () => {
  it("returns career for the career sentinel", () => {
    expect(resolveSeasonScope({ requested: CAREER_SCOPE, availableSeasons: SEASONS })).toEqual({
      kind: "career",
    });
  });

  it("uses a requested season that the player actually has", () => {
    expect(resolveSeasonScope({ requested: "2023-24", availableSeasons: SEASONS })).toEqual({
      kind: "season",
      season: "2023-24",
    });
  });

  it("falls back to the most recent season when the request is blank or unknown", () => {
    expect(resolveSeasonScope({ requested: "", availableSeasons: SEASONS })).toEqual({
      kind: "season",
      season: "2025-26",
    });
    expect(resolveSeasonScope({ requested: "1999-00", availableSeasons: SEASONS })).toEqual({
      kind: "season",
      season: "2025-26",
    });
  });

  it("falls back to career when the player has no season rows", () => {
    expect(resolveSeasonScope({ requested: "", availableSeasons: [] })).toEqual({ kind: "career" });
  });
});

describe("seasonScopeValue", () => {
  it("maps scopes back to the select value", () => {
    expect(seasonScopeValue({ kind: "career" })).toBe(CAREER_SCOPE);
    expect(seasonScopeValue({ kind: "season", season: "2024-25" })).toBe("2024-25");
  });
});
