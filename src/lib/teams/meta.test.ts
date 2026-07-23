import { describe, expect, it } from "vitest";

import {
  CONFERENCE_BY_DIVISION,
  DIVISIONS,
  TEAM_META,
  teamByAbbr,
  teamBySlug,
} from "@/lib/teams/meta";

describe("TEAM_META", () => {
  it("covers all 30 teams with unique slugs and abbreviations", () => {
    expect(TEAM_META).toHaveLength(30);
    expect(new Set(TEAM_META.map((team) => team.slug)).size).toBe(30);
    expect(new Set(TEAM_META.map((team) => team.abbr)).size).toBe(30);
  });

  it("puts five teams in each division and fifteen per conference", () => {
    DIVISIONS.map((division) => {
      const teams = TEAM_META.filter((team) => team.division === division);
      expect(teams).toHaveLength(5);
      teams.map((team) => expect(team.conference).toBe(CONFERENCE_BY_DIVISION[division]));
    });
    expect(TEAM_META.filter((team) => team.conference === "East")).toHaveLength(15);
    expect(TEAM_META.filter((team) => team.conference === "West")).toHaveLength(15);
  });

  it("resolves slugs case-insensitively", () => {
    expect(teamBySlug("raptors")?.abbr).toBe("TOR");
    expect(teamBySlug("Trail-Blazers")?.abbr).toBe("POR");
    expect(teamBySlug("gremlins")).toBeUndefined();
  });

  it("resolves abbreviations", () => {
    expect(teamByAbbr("BOS")?.slug).toBe("celtics");
    expect(teamByAbbr("XXX")).toBeUndefined();
  });
});
