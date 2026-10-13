import { describe, expect, it } from "bun:test";

import { teamNameToSlug } from "#core/roster/slug";

describe("teamNameToSlug", () => {
  it("converts a team name to a hyphenated lowercase slug", () => {
    expect(teamNameToSlug({ name: "Bench Mob" })).toBe("bench-mob");
  });

  it("collapses punctuation and repeated separators into single hyphens", () => {
    expect(teamNameToSlug({ name: "The 6th Man's Army!" })).toBe("the-6th-man-s-army");
    expect(teamNameToSlug({ name: "  Double   Space  " })).toBe("double-space");
    expect(teamNameToSlug({ name: "---Weird---" })).toBe("weird");
  });

  it("handles single-word and numeric names", () => {
    expect(teamNameToSlug({ name: "Dynasty" })).toBe("dynasty");
    expect(teamNameToSlug({ name: "Team 2" })).toBe("team-2");
  });

  it("leaves an existing slug unchanged", () => {
    ["bench-mob", "the-6th-man-s-army", "team-2", "dynasty"].map((slug) => {
      expect(teamNameToSlug({ name: slug })).toBe(slug);
    });
  });
});
