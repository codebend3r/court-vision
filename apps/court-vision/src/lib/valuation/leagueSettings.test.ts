import { describe, expect, it } from "bun:test";

import { buildLeagueSeed, configFromSeed } from "@/lib/leagues/fantasyDefaults";
import { type LeagueSummary } from "@/lib/leagues/types";
import { leagueValuationSettings } from "@/lib/valuation/leagueSettings";

const league: LeagueSummary = {
  id: "a",
  name: "Alpha",
  slug: "alpha",
  scoringType: "h2h_categories",
  teamCount: 10,
  rosterSlots: 15,
  scoringConfig: { categories: ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg"] },
  provider: "manual",
  syncVia: "server",
  isImported: false,
  externalUrl: null,
  myTeamId: null,
  syncedAt: null,
  syncError: null,
  unsupportedCategories: [],
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
};

describe("leagueValuationSettings", () => {
  it("values on the league's settings, as the Fantasy tab first loads them", () => {
    const settings = leagueValuationSettings({ league, preferredFormula: null });
    const expected = configFromSeed({
      seed: buildLeagueSeed({ league, preferredFormula: null, presentKeys: new Set() }),
    });

    expect(settings.config).toEqual(expected.config);
    expect(settings.methodWeights).toEqual(expected.methodWeights);
    expect(settings.config.teams).toBe(10);
  });

  it("uses the preferred formula, falling back to Z-Score for none or an unknown one", () => {
    expect(leagueValuationSettings({ league, preferredFormula: "sgp" }).method).toBe("sgp");
    expect(leagueValuationSettings({ league, preferredFormula: null }).method).toBe("zscore");
    expect(leagueValuationSettings({ league: null, preferredFormula: "nope" }).method).toBe(
      "zscore",
    );
  });
});
