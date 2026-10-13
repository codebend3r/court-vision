import { describe, expect, it } from "bun:test";

import { HAS_GAME_LOGS, LATEST_SEASON_JOIN, PLAYER_IDENTITY_COLUMNS } from "@/lib/players/sql";
import { SEASON_TYPE } from "@/lib/stats/season";

describe("player SQL fragments", () => {
  it("binds the season type as a parameter in the latest-season join", () => {
    expect(LATEST_SEASON_JOIN.sql).toContain('"PlayerSeasonStats"');
    expect(LATEST_SEASON_JOIN.sql).not.toContain(SEASON_TYPE);
    expect(LATEST_SEASON_JOIN.values).toEqual([SEASON_TYPE]);
  });

  it("selects every identity column off the player alias", () => {
    ["p.id", 'p."firstName"', 'p."lastName"', 'p."fullName"', 'p."teamAbbr"', "p.position"].forEach(
      (column) => {
        expect(PLAYER_IDENTITY_COLUMNS.sql).toContain(column);
      },
    );
    expect(PLAYER_IDENTITY_COLUMNS.sql).toContain('p."nbaPersonId"');
  });

  it("checks for game logs without binding anything", () => {
    expect(HAS_GAME_LOGS.sql).toContain('"PlayerGameLog"');
    expect(HAS_GAME_LOGS.values).toEqual([]);
  });
});
