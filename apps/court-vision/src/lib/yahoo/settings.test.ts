import { describe, expect, it } from "bun:test";

import { parseScoringConfig } from "@vision/sport-basketball/engine";
import { type Category } from "@vision/sport-basketball/types";

import league106344 from "@/lib/yahoo/fixtures/league-106344.json";
import { yahooLeagueSnapshotSchema, type YahooLeague } from "@/lib/yahoo/schemas";
import { mapLeagueSettings, toSlotType } from "@/lib/yahoo/settings";

const gameOfCourts = (): YahooLeague =>
  yahooLeagueSnapshotSchema.parse(league106344).fantasy_content.league;

const withSettings = ({
  league,
  settings,
}: {
  league: YahooLeague;
  settings: Partial<YahooLeague["settings"]>;
}): YahooLeague => ({ ...league, settings: { ...league.settings, ...settings } });

const NINE_CATEGORIES: Category[] = ["fg", "ft", "tpm", "pts", "reb", "ast", "stl", "blk", "tov"];

describe("mapLeagueSettings", () => {
  it("maps Game of Courts to 9-cat head-to-head", () => {
    const mapped = mapLeagueSettings({ league: gameOfCourts() });

    expect(mapped).toEqual({
      status: "ok",
      scoring: {
        scoringType: "h2h_categories",
        scoringConfig: { categories: NINE_CATEGORIES },
        unsupportedCategories: [],
      },
      slotLayout: [
        "PG",
        "SG",
        "G",
        "G",
        "G",
        "SF",
        "PF",
        "F",
        "F",
        "C",
        "UTIL",
        "UTIL",
        "UTIL",
        "IL",
        "IL",
      ],
      rosterSlots: 13,
      teamCount: 12,
    });
  });

  it("returns a config that parseScoringConfig accepts unchanged", () => {
    const mapped = mapLeagueSettings({ league: gameOfCourts() });

    expect(mapped.status).toBe("ok");
    if (mapped.status !== "ok") return;
    expect(
      parseScoringConfig({
        scoringType: mapped.scoring.scoringType,
        value: mapped.scoring.scoringConfig,
      }),
    ).toEqual(mapped.scoring.scoringConfig);
  });

  it("skips display-only stats", () => {
    const mapped = mapLeagueSettings({ league: gameOfCourts() });

    expect(mapped.status).toBe("ok");
    if (mapped.status !== "ok") return;
    expect(mapped.scoring.unsupportedCategories).not.toContain("FGM/A");
    expect(mapped.scoring.unsupportedCategories).not.toContain("FTM/A");
    expect(JSON.stringify(mapped.scoring.scoringConfig)).not.toContain("9004003");
    expect(mapped.scoring.scoringConfig).toEqual({ categories: NINE_CATEGORIES });
  });

  it("drops an unsupported category and names it", () => {
    const league = gameOfCourts();
    const mapped = mapLeagueSettings({
      league: withSettings({
        league,
        settings: {
          stat_categories: {
            stats: [
              ...league.settings.stat_categories.stats,
              {
                stat_id: 23,
                display_name: "DD",
                position_type: undefined,
                is_only_display_stat: false,
              },
            ],
          },
        },
      }),
    });

    expect(mapped.status).toBe("ok");
    if (mapped.status !== "ok") return;
    expect(mapped.scoring.unsupportedCategories).toEqual(["DD"]);
    expect(mapped.scoring.scoringConfig).toEqual({ categories: NINE_CATEGORIES });
  });

  it("maps roto", () => {
    const mapped = mapLeagueSettings({ league: { ...gameOfCourts(), scoring_type: "roto" } });

    expect(mapped.status).toBe("ok");
    if (mapped.status !== "ok") return;
    expect(mapped.scoring.scoringType).toBe("roto");
    expect(mapped.scoring.scoringConfig).toEqual({ categories: NINE_CATEGORIES });
    expect(
      parseScoringConfig({ scoringType: "roto", value: mapped.scoring.scoringConfig }),
    ).toEqual(mapped.scoring.scoringConfig);
  });

  it("maps points modifiers and zero-fills the rest", () => {
    const league = gameOfCourts();
    const mapped = mapLeagueSettings({
      league: withSettings({
        league: { ...league, scoring_type: "headpoint" },
        settings: {
          stat_categories: {
            stats: [
              ...league.settings.stat_categories.stats,
              {
                stat_id: 23,
                display_name: "DD",
                position_type: undefined,
                is_only_display_stat: false,
              },
            ],
          },
          stat_modifiers: [
            { stat_id: 12, value: 1 },
            { stat_id: 15, value: 1.2 },
            { stat_id: 19, value: -1 },
            { stat_id: 23, value: 2 },
          ],
        },
      }),
    });

    expect(mapped.status).toBe("ok");
    if (mapped.status !== "ok") return;
    expect(mapped.scoring).toEqual({
      scoringType: "h2h_points",
      scoringConfig: { scoring: { pts: 1, reb: 1.2, ast: 0, stl: 0, blk: 0, fg3m: 0, tov: -1 } },
      unsupportedCategories: ["DD"],
    });
    expect(
      parseScoringConfig({ scoringType: "h2h_points", value: mapped.scoring.scoringConfig }),
    ).toEqual(mapped.scoring.scoringConfig);
  });

  it("maps plain points leagues without modifiers to all-zero scoring", () => {
    const mapped = mapLeagueSettings({ league: { ...gameOfCourts(), scoring_type: "point" } });

    expect(mapped.status).toBe("ok");
    if (mapped.status !== "ok") return;
    expect(mapped.scoring.scoringType).toBe("h2h_points");
    expect(mapped.scoring.scoringConfig).toEqual({
      scoring: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fg3m: 0, tov: 0 },
    });
  });

  it("refuses High Score and unknown scoring types", () => {
    expect(mapLeagueSettings({ league: { ...gameOfCourts(), is_highscore: true } })).toEqual({
      status: "unsupported",
      reason: "highscore",
    });
    expect(mapLeagueSettings({ league: { ...gameOfCourts(), scoring_type: "weird" } })).toEqual({
      status: "unsupported",
      reason: "scoring_type",
    });
  });

  it("clamps team count and roster slots to the league bounds", () => {
    const league = gameOfCourts();
    const mapped = mapLeagueSettings({
      league: withSettings({
        league: { ...league, num_teams: 99 },
        settings: {
          roster_positions: [{ position: "Util", count: 40, is_starting_position: true }],
        },
      }),
    });

    expect(mapped).toMatchObject({ status: "ok", teamCount: 30, rosterSlots: 25 });
  });

  it("maps bench and injured-list positions", () => {
    const league = gameOfCourts();
    const mapped = mapLeagueSettings({
      league: withSettings({
        league,
        settings: {
          roster_positions: [
            { position: "C", count: 1, is_starting_position: true },
            { position: "BN", count: 2, is_starting_position: false },
            { position: "IL+", count: 1, is_starting_position: false },
          ],
        },
      }),
    });

    expect(mapped).toMatchObject({
      status: "ok",
      slotLayout: ["C", "BENCH", "BENCH", "ILPLUS"],
      rosterSlots: 3,
    });
  });
});

describe("toSlotType", () => {
  it("maps Yahoo positions onto slot types", () => {
    expect(toSlotType({ position: "Util" })).toBe("UTIL");
    expect(toSlotType({ position: "BN" })).toBe("BENCH");
    expect(toSlotType({ position: "IL" })).toBe("IL");
    expect(toSlotType({ position: "IL+" })).toBe("ILPLUS");
    expect(toSlotType({ position: "PG" })).toBe("PG");
  });

  it("treats an unknown position as bench", () => {
    expect(toSlotType({ position: "NA" })).toBe("BENCH");
    expect(toSlotType({ position: null })).toBe("BENCH");
  });
});
