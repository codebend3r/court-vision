import { describe, expect, it } from "vitest";

import {
  bdlAdvancedStatSchema,
  bdlPage,
  bdlPaginatedPage,
  bdlPlayerSchema,
  bdlStatSchema,
  bdlTeamSchema,
} from "@/lib/balldontlie/schemas";

const team = { id: 1, abbreviation: "ATL", full_name: "Atlanta Hawks", extra: "ignored" };

const statRow = {
  id: 15531179,
  min: "30",
  fgm: 7,
  fga: 18,
  fg_pct: 0.389,
  fg3m: 5,
  fg3a: 9,
  ftm: 4,
  fta: 4,
  oreb: 2,
  dreb: 5,
  reb: 7,
  ast: 1,
  stl: 1,
  blk: 0,
  turnover: 1,
  pf: 3,
  pts: 23,
  plus_minus: 23,
  player: {
    id: 115,
    first_name: "Stephen",
    last_name: "Curry",
    position: "G",
    jersey_number: "30",
    team_id: 10,
  },
  team: { id: 10, abbreviation: "GSW" },
  game: {
    id: 18422,
    date: "2025-10-22",
    season: 2025,
    home_team_id: 10,
    visitor_team_id: 2,
    home_team_score: 112,
    visitor_team_score: 108,
    postseason: false,
  },
};

describe("bdlTeamSchema", () => {
  it("parses a team and strips unknown keys", () => {
    expect(bdlTeamSchema.parse(team)).toEqual({
      id: 1,
      abbreviation: "ATL",
      full_name: "Atlanta Hawks",
    });
  });
});

describe("bdlPlayerSchema", () => {
  it("retains profile and draft metadata", () => {
    const player = bdlPlayerSchema.parse({
      id: 115,
      first_name: "Stephen",
      last_name: "Curry",
      height: "6-2",
      weight: "185",
      college: "Davidson",
      country: "USA",
      draft_year: 2009,
      draft_round: 1,
      draft_number: 7,
    });
    expect(player).toMatchObject({
      height: "6-2",
      weight: "185",
      college: "Davidson",
      draft_year: 2009,
    });
  });
});

describe("bdlStatSchema", () => {
  it("parses a stat row with nested player/team/game", () => {
    const parsed = bdlStatSchema.parse(statRow);
    expect(parsed.player.id).toBe(115);
    expect(parsed.team.abbreviation).toBe("GSW");
    expect(parsed.game.home_team_id).toBe(10);
    expect(parsed.turnover).toBe(1);
    expect(parsed.plus_minus).toBe(23);
  });

  it("accepts null min and null plus_minus", () => {
    const parsed = bdlStatSchema.parse({ ...statRow, min: null, plus_minus: null });
    expect(parsed.min).toBeNull();
    expect(parsed.plus_minus).toBeNull();
  });

  it("rejects a row missing the game object", () => {
    const withoutGame = { ...statRow, game: undefined };
    expect(() => bdlStatSchema.parse(withoutGame)).toThrow();
  });
});

const advancedStatRow = {
  id: 15531179,
  pie: 0.152,
  pace: 98.4,
  assist_percentage: 21.3,
  assist_ratio: 18.9,
  assist_to_turnover: 2.1,
  defensive_rating: 108.2,
  defensive_rebound_percentage: 14.5,
  effective_field_goal_percentage: 0.556,
  net_rating: 6.4,
  offensive_rating: 114.6,
  offensive_rebound_percentage: 3.1,
  rebound_percentage: 8.8,
  true_shooting_percentage: 0.612,
  turnover_ratio: 9.2,
  usage_percentage: 28.7,
  player: {
    id: 115,
    first_name: "Stephen",
    last_name: "Curry",
    position: "G",
    height: "6-2",
    weight: "185",
    jersey_number: "30",
    college: "Davidson",
    country: "USA",
    draft_year: 2009,
    draft_round: 1,
    draft_number: 7,
    team_id: 10,
  },
  team: {
    id: 10,
    conference: "West",
    division: "Pacific",
    city: "Golden State",
    name: "Warriors",
    full_name: "Golden State Warriors",
    abbreviation: "GSW",
  },
  game: {
    id: 18422,
    date: "2025-10-22",
    season: 2025,
    status: "Final",
    period: 4,
    time: "",
    postseason: false,
    postponed: false,
    home_team_score: 112,
    visitor_team_score: 108,
    home_team_id: 10,
    visitor_team_id: 2,
    ist_stage: null,
  },
};

describe("bdlAdvancedStatSchema", () => {
  it("parses an advanced row and strips extra nested keys", () => {
    const parsed = bdlAdvancedStatSchema.parse(advancedStatRow);
    expect(parsed.pie).toBe(0.152);
    expect(parsed.usage_percentage).toBe(28.7);
    expect(parsed.player.id).toBe(115);
    expect(parsed.team.abbreviation).toBe("GSW");
    expect(parsed.game.home_team_id).toBe(10);
    // extra nested fields (conference, status, ...) are dropped by Zod
    expect(parsed.team).not.toHaveProperty("conference");
    expect(parsed.game).not.toHaveProperty("status");
  });

  it("accepts null metric values for players who logged no minutes", () => {
    const nulled = {
      ...advancedStatRow,
      pie: null,
      pace: null,
      offensive_rating: null,
      usage_percentage: null,
    };
    const parsed = bdlAdvancedStatSchema.parse(nulled);
    expect(parsed.pie).toBeNull();
    expect(parsed.usage_percentage).toBeNull();
  });

  it("rejects a row missing the game object", () => {
    expect(() => bdlAdvancedStatSchema.parse({ ...advancedStatRow, game: undefined })).toThrow();
  });
});

describe("bdlPage", () => {
  it("parses the paginated envelope with a next_cursor", () => {
    const page = bdlPage(bdlTeamSchema).parse({
      data: [team],
      meta: { next_cursor: 25, per_page: 25 },
    });
    expect(page.data).toHaveLength(1);
    expect(page.meta?.next_cursor ?? null).toBe(25);
  });

  it("allows a missing next_cursor", () => {
    const page = bdlPage(bdlTeamSchema).parse({ data: [], meta: { per_page: 25 } });
    expect(page.meta?.next_cursor ?? null).toBeNull();
  });

  it("allows a missing meta key entirely", () => {
    const page = bdlPage(bdlTeamSchema).parse({ data: [team] });
    expect(page.data).toHaveLength(1);
    expect(page.meta?.next_cursor ?? null).toBeNull();
  });
});

describe("bdlPaginatedPage", () => {
  it("parses a page with meta and exposes next_cursor", () => {
    const page = bdlPaginatedPage(bdlTeamSchema).parse({
      data: [team],
      meta: { next_cursor: 25, per_page: 25 },
    });
    expect(page.data).toHaveLength(1);
    expect(page.meta.next_cursor ?? null).toBe(25);
  });

  it("allows a null next_cursor inside meta (last page)", () => {
    const page = bdlPaginatedPage(bdlTeamSchema).parse({
      data: [],
      meta: { next_cursor: null, per_page: 25 },
    });
    expect(page.meta.next_cursor ?? null).toBeNull();
  });

  it("rejects a response missing meta entirely", () => {
    expect(() => bdlPaginatedPage(bdlTeamSchema).parse({ data: [team] })).toThrow();
  });
});
