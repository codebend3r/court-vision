import { describe, expect, it } from "bun:test";

import {
  CONFERENCE_BY_DIVISION,
  DIVISIONS,
  NBA_TEAMS,
  teamBySlug,
  teamColorsFor,
} from "@/lib/teams/meta";

describe("NBA_TEAMS", () => {
  it("covers all 30 teams with unique slugs and abbreviations", () => {
    expect(NBA_TEAMS).toHaveLength(30);
    expect(new Set(NBA_TEAMS.map((team) => team.slug)).size).toBe(30);
    expect(new Set(NBA_TEAMS.map((team) => team.abbreviation)).size).toBe(30);
  });

  it("puts five teams in each division and fifteen per conference", () => {
    DIVISIONS.map((division) => {
      const teams = NBA_TEAMS.filter((team) => team.division === division);
      expect(teams).toHaveLength(5);
      teams.map((team) => expect(team.conference).toBe(CONFERENCE_BY_DIVISION[division]));
    });
    expect(NBA_TEAMS.filter((team) => team.conference === "East")).toHaveLength(15);
    expect(NBA_TEAMS.filter((team) => team.conference === "West")).toHaveLength(15);
  });
});

describe("teamBySlug", () => {
  it("resolves slugs case-insensitively", () => {
    expect(teamBySlug({ slug: "raptors" })?.abbreviation).toBe("TOR");
    expect(teamBySlug({ slug: "Trail-Blazers" })?.abbreviation).toBe("POR");
    expect(teamBySlug({ slug: "gremlins" })).toBeUndefined();
  });
});

describe("teamColorsFor", () => {
  it("returns a known team's name and colors", () => {
    expect(teamColorsFor({ team: "BKN" })).toMatchObject({
      name: "Brooklyn Nets",
      primary: "#000000",
      secondary: "#FFFFFF",
    });
  });

  it("returns null for an unknown or missing team", () => {
    expect(teamColorsFor({ team: "SEA" })).toBeNull();
    expect(teamColorsFor({ team: null })).toBeNull();
  });
});
