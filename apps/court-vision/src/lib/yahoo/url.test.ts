import { describe, expect, it } from "bun:test";

import { parseYahooLeagueUrl } from "@/lib/yahoo/url";

const HOST = "basketball.fantasysports.yahoo.com";

describe("parseYahooLeagueUrl", () => {
  it.each([
    ["a bare league id", "106344"],
    ["a bare league id with surrounding whitespace", " 106344 "],
    ["a full league URL", `https://${HOST}/nba/106344`],
    ["a league URL without a scheme", `${HOST}/nba/106344`],
    ["an http league URL with a trailing slash", `http://${HOST}/nba/106344/`],
    ["a team page inside the league", `https://${HOST}/nba/106344/5`],
    ["a page inside the league with a query string", `https://${HOST}/nba/106344/players?status=A`],
    [
      "a league URL with a query string and a fragment",
      `https://${HOST}/nba/106344?lhst=stand#standings`,
    ],
  ])("accepts a league id, a league URL or any page inside the league: %s", (_label, input) => {
    expect(parseYahooLeagueUrl({ input })).toEqual({ status: "ok", leagueId: "106344" });
  });

  it.each([
    ["a season-prefixed league URL", `https://${HOST}/2025/nba/91581`, 2025],
    ["an archive league URL", `https://${HOST}/archive/nba/2019/1234`, 2019],
  ])("reports a past season instead of importing it: %s", (_label, input, season) => {
    expect(parseYahooLeagueUrl({ input })).toEqual({ status: "past_season", season });
  });

  it.each([
    ["a football league", "https://football.fantasysports.yahoo.com/f1/12345"],
    ["a hockey league", "https://hockey.fantasysports.yahoo.com/hockey/123"],
  ])("rejects a league from another Yahoo sport: %s", (_label, input) => {
    expect(parseYahooLeagueUrl({ input })).toEqual({ status: "wrong_sport" });
  });

  it.each([
    ["an empty string", ""],
    ["a word", "abc"],
    ["another site", "https://espn.com/nba/106344"],
    ["a URL with no league id", `https://${HOST}/nba`],
    ["a URL with a non-numeric league id", `https://${HOST}/nba/abc`],
    ["an id longer than nine digits", "12345678901"],
  ])("rejects input that is not a Yahoo basketball league: %s", (_label, input) => {
    expect(parseYahooLeagueUrl({ input })).toEqual({ status: "invalid" });
  });
});
