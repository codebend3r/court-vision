import { describe, expect, it } from "vitest";

import { teamNameToSlug, teamSlugToName } from "@/lib/fantasyTeams/slug";

describe("teamNameToSlug", () => {
  it("converts a team name to a hyphenated lowercase slug", () => {
    expect(teamNameToSlug("Bench Mob")).toBe("bench-mob");
  });

  it("collapses punctuation and repeated separators into single hyphens", () => {
    expect(teamNameToSlug("The 6th Man's Army!")).toBe("the-6th-man-s-army");
    expect(teamNameToSlug("  Double   Space  ")).toBe("double-space");
    expect(teamNameToSlug("---Weird---")).toBe("weird");
  });

  it("handles single-word and numeric names", () => {
    expect(teamNameToSlug("Dynasty")).toBe("dynasty");
    expect(teamNameToSlug("Team 2")).toBe("team-2");
  });
});

describe("teamSlugToName", () => {
  it("converts a slug back to a title-cased name", () => {
    expect(teamSlugToName("bench-mob")).toBe("Bench Mob");
    expect(teamSlugToName("dynasty")).toBe("Dynasty");
    expect(teamSlugToName("team-2")).toBe("Team 2");
  });

  it("ignores empty segments", () => {
    expect(teamSlugToName("bench--mob")).toBe("Bench Mob");
    expect(teamSlugToName("")).toBe("");
  });
});

describe("round trips", () => {
  it("name → slug → name survives for simple title-cased names", () => {
    ["Bench Mob", "Dynasty", "Team 2"].forEach((name) => {
      expect(teamSlugToName(teamNameToSlug(name))).toBe(name);
    });
  });

  it("slug → name → slug is always stable", () => {
    ["bench-mob", "the-6th-man-s-army", "team-2", "dynasty"].forEach((slug) => {
      expect(teamNameToSlug(teamSlugToName(slug))).toBe(slug);
    });
  });
});
