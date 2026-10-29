import { describe, expect, it } from "bun:test";

import { loadMatchupSearchParams, matchupHref } from "@/lib/matchups/searchParams";

describe("matchupHref", () => {
  it("leaves the defaults out of the URL", () => {
    expect(matchupHref({ view: "matchup" })).toBe("/matchup");
    expect(matchupHref({ view: "matchup", week: null })).toBe("/matchup");
  });

  it("names the view and the week", () => {
    expect(matchupHref({ view: "league" })).toBe("/matchup?view=league");
    expect(matchupHref({ view: "matchup", week: 3 })).toBe("/matchup?week=3");
    expect(matchupHref({ view: "league", week: 3 })).toBe("/matchup?view=league&week=3");
  });

  it("never puts a week on the Season view", () => {
    expect(matchupHref({ view: "season", week: 3 })).toBe("/matchup?view=season");
  });
});

describe("loadMatchupSearchParams", () => {
  it("reads the view and the week, defaulting to my matchup and no week", () => {
    expect(loadMatchupSearchParams({ view: "season", week: "2" })).toEqual({
      view: "season",
      week: 2,
    });
    expect(loadMatchupSearchParams({})).toEqual({ view: "matchup", week: null });
    expect(loadMatchupSearchParams({ view: "nope", week: "x" })).toEqual({
      view: "matchup",
      week: null,
    });
  });
});
