import { describe, expect, it } from "bun:test";

import { hasSeasonLogs, seasonStatsJoin, PLAYER_IDENTITY_COLUMNS } from "@/lib/players/sql";
import { SEASON_LABEL, SEASON_TYPE } from "@/lib/stats/season";

describe("player SQL fragments", () => {
  it("binds the season and season type as parameters in the current-season join", () => {
    const CURRENT_SEASON_JOIN = seasonStatsJoin({ season: SEASON_LABEL });
    expect(CURRENT_SEASON_JOIN.sql).toContain('"PlayerSeasonStats"');
    expect(CURRENT_SEASON_JOIN.sql).not.toContain(SEASON_TYPE);
    expect(CURRENT_SEASON_JOIN.sql).not.toContain(SEASON_LABEL);
    expect(CURRENT_SEASON_JOIN.values).toEqual([SEASON_LABEL, SEASON_TYPE]);
  });

  it("selects every identity column off the player alias", () => {
    ["p.id", 'p."firstName"', 'p."lastName"', 'p."fullName"', 'p."teamAbbr"', "p.position"].forEach(
      (column) => {
        expect(PLAYER_IDENTITY_COLUMNS.sql).toContain(column);
      },
    );
    expect(PLAYER_IDENTITY_COLUMNS.sql).toContain('p."nbaPersonId"');
  });

  it("checks for logs only in the selected regular season", () => {
    const logs = hasSeasonLogs({ season: SEASON_LABEL });
    expect(logs.sql).toContain('"PlayerGameLog"');
    expect(logs.values).toEqual([SEASON_LABEL, SEASON_TYPE]);
  });
});
