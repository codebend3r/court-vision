import { describe, expect, it, vi } from "vitest";

import { fetchPlayerGameLogs, fetchPlayerIndex, fetchSeasonStats } from "./endpoints";

const noopSleep = async (): Promise<void> => {};
const okResponse = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const wrap = (name: string, headers: string[], rowSet: unknown[][]): unknown => ({
  resultSets: [{ name, headers, rowSet }],
});

describe("fetchPlayerIndex", () => {
  it("sends season/league params and returns validated rows", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      okResponse(
        wrap(
          "PlayerIndex",
          [
            "PERSON_ID",
            "PLAYER_FIRST_NAME",
            "PLAYER_LAST_NAME",
            "TEAM_ID",
            "TEAM_ABBREVIATION",
            "POSITION",
            "JERSEY_NUMBER",
          ],
          [[1629029, "Luka", "Doncic", 1610612747, "LAL", "G-F", "77"]],
        ),
      ),
    );
    const rows = await fetchPlayerIndex({ fetchImpl, sleep: noopSleep });
    expect(rows).toHaveLength(1);
    expect(rows[0].PLAYER_LAST_NAME).toBe("Doncic");
    const url = fetchImpl.mock.lastCall?.[0]?.toString() ?? "";
    expect(url).toContain("/playerindex?");
    expect(url).toContain("Season=2025-26");
    expect(url).toContain("LeagueID=00");
  });
});

describe("fetchSeasonStats", () => {
  it("sends Regular Season + Totals params", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      okResponse(
        wrap(
          "LeagueDashPlayerStats",
          [
            "PLAYER_ID",
            "GP",
            "MIN",
            "FGM",
            "FGA",
            "FG3M",
            "FG3A",
            "FTM",
            "FTA",
            "OREB",
            "DREB",
            "REB",
            "AST",
            "STL",
            "BLK",
            "TOV",
            "PTS",
          ],
          [[201939, 70, 2400, 600, 1200, 300, 700, 200, 220, 50, 300, 350, 450, 90, 20, 200, 1700]],
        ),
      ),
    );
    const rows = await fetchSeasonStats({ fetchImpl, sleep: noopSleep });
    expect(rows[0].PTS).toBe(1700);
    const url = fetchImpl.mock.lastCall?.[0]?.toString() ?? "";
    expect(url).toContain("/leaguedashplayerstats?");
    expect(url).toContain("SeasonType=Regular+Season");
    expect(url).toContain("PerMode=Totals");
  });
});

describe("fetchPlayerGameLogs", () => {
  it("passes the date window through", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      okResponse(
        wrap(
          "PlayerGameLogs",
          [
            "PLAYER_ID",
            "GAME_ID",
            "GAME_DATE",
            "TEAM_ID",
            "TEAM_ABBREVIATION",
            "MATCHUP",
            "WL",
            "MIN",
            "FGM",
            "FGA",
            "FG3M",
            "FG3A",
            "FTM",
            "FTA",
            "OREB",
            "DREB",
            "REB",
            "AST",
            "STL",
            "BLK",
            "TOV",
            "PTS",
            "PLUS_MINUS",
          ],
          [
            [
              201939,
              "0022500001",
              "2025-10-22T00:00:00",
              1610612744,
              "GSW",
              "GSW vs. LAL",
              "W",
              34,
              10,
              20,
              5,
              11,
              4,
              4,
              1,
              4,
              5,
              8,
              2,
              0,
              3,
              29,
              12,
            ],
          ],
        ),
      ),
    );
    const rows = await fetchPlayerGameLogs({
      dateFrom: "10/01/2025",
      dateTo: "10/31/2025",
      fetchImpl,
      sleep: noopSleep,
    });
    expect(rows[0].GAME_ID).toBe("0022500001");
    const url = fetchImpl.mock.lastCall?.[0]?.toString() ?? "";
    expect(url).toContain("/playergamelogs?");
    expect(url).toContain("DateFrom=10%2F01%2F2025");
    expect(url).toContain("DateTo=10%2F31%2F2025");
  });
});
