import { describe, expect, it } from "bun:test";

import { rosterGate } from "@/lib/leagues/rosterGate";
import { type LeagueSummary } from "@/lib/leagues/types";

const ready: LeagueSummary = {
  id: "a",
  name: "Alpha",
  slug: "alpha",
  scoringType: "h2h_categories",
  teamCount: 10,
  rosterSlots: 15,
  scoringConfig: { categories: ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg"] },
  provider: "yahoo",
  syncVia: "server",
  isImported: true,
  externalUrl: null,
  myTeamId: "team-1",
  syncedAt: null,
  syncError: null,
  unsupportedCategories: [],
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
};

describe("rosterGate", () => {
  it("blocks without a league", () => {
    expect(rosterGate({ league: null })).toEqual({ kind: "no_league" });
  });

  it("blocks a league that was not imported from Yahoo", () => {
    expect(rosterGate({ league: { ...ready, isImported: false } })).toEqual({
      kind: "not_imported",
    });
  });

  it("blocks a points league", () => {
    expect(rosterGate({ league: { ...ready, scoringType: "h2h_points" } })).toEqual({
      kind: "points",
    });
  });

  it("asks for the team when none is picked yet", () => {
    expect(rosterGate({ league: { ...ready, myTeamId: null } })).toEqual({
      kind: "no_team",
      leagueId: "a",
    });
  });

  it("checks import before scoring, so an unimported points league asks to import", () => {
    expect(
      rosterGate({ league: { ...ready, isImported: false, scoringType: "h2h_points" } }).kind,
    ).toBe("not_imported");
  });

  it("is ready with the league and its picked team", () => {
    expect(rosterGate({ league: ready })).toEqual({
      kind: "ready",
      league: ready,
      myTeamId: "team-1",
    });
  });
});
