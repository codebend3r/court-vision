import { describe, expect, it } from "vitest";

import {
  buildPlayersHref,
  isAdvancedMetricKey,
  parsePlayersSearchParams,
} from "@/lib/players/searchParams";

describe("parsePlayersSearchParams", () => {
  it("returns defaults for empty input", () => {
    expect(parsePlayersSearchParams({})).toEqual({
      q: "",
      page: 1,
      size: 50,
      sort: "pts",
      dir: "desc",
      range: "all",
      mode: "average",
      minimums: true,
      tab: "regular",
    });
  });

  it.each([
    [{ q: "  curry  " }, { q: "curry" }],
    [{ q: "x".repeat(150) }, { q: "x".repeat(100) }],
    [{ page: "3" }, { page: 3 }],
    [{ page: "0" }, { page: 1 }],
    [{ page: "-2" }, { page: 1 }],
    [{ page: "abc" }, { page: 1 }],
    [{ page: "9".repeat(400) }, { page: 1 }],
    [{ page: "99999999999999999999" }, { page: 1 }],
    [{ size: "50" }, { size: 50 }],
    [{ size: "33" }, { size: 50 }],
    [{ size: "" }, { size: 50 }],
    [{ sort: "lastName" }, { sort: "lastName" }],
    [{ sort: "firstName" }, { sort: "firstName" }],
    [{ sort: "teamAbbr" }, { sort: "pts" }],
    [{ sort: "" }, { sort: "pts" }],
    [{ dir: "desc" }, { dir: "desc" }],
    [{ dir: "asc" }, { dir: "asc" }],
    [{ dir: "up" }, { dir: "desc" }],
    [{ range: "last5" }, { range: "last5" }],
    [{ range: "last20" }, { range: "last20" }],
    [{ range: "10" }, { range: "all" }],
    [{ mode: "total" }, { mode: "total" }],
    [{ mode: "perGame" }, { mode: "average" }],
    [{ minimums: "0" }, { minimums: false }],
    [{ minimums: "1" }, { minimums: true }],
    [{ minimums: "false" }, { minimums: true }],
    [{ tab: "advanced" }, { tab: "advanced" }],
    [{ tab: "fantasy" }, { tab: "fantasy" }],
    [{ tab: "bogus" }, { tab: "regular" }],
    [{ tab: "" }, { tab: "regular" }],
  ])("normalizes %j", (raw, expected) => {
    expect(parsePlayersSearchParams(raw)).toMatchObject(expected);
  });

  it("validates sort against the advanced tab's own key set, defaulting to pie", () => {
    expect(parsePlayersSearchParams({ tab: "advanced", sort: "usagePercentage" })).toMatchObject({
      tab: "advanced",
      sort: "usagePercentage",
    });
    expect(parsePlayersSearchParams({ tab: "advanced", sort: "pts" })).toMatchObject({
      tab: "advanced",
      sort: "pie",
    });
    expect(parsePlayersSearchParams({ tab: "advanced", sort: "firstName" })).toMatchObject({
      tab: "advanced",
      sort: "firstName",
    });
  });

  it("validates sort against the regular tab's own key set, defaulting to pts", () => {
    expect(parsePlayersSearchParams({ tab: "regular", sort: "pie" })).toMatchObject({
      tab: "regular",
      sort: "pts",
    });
    expect(parsePlayersSearchParams({ sort: "pie" })).toMatchObject({
      tab: "regular",
      sort: "pts",
    });
  });
});

describe("buildPlayersHref", () => {
  const defaults = {
    q: "",
    page: 1,
    size: 50,
    sort: "pts",
    dir: "desc",
    range: "all",
    mode: "average",
    minimums: true,
    tab: "regular",
  } as const;

  it("returns the bare path when everything is default", () => {
    expect(buildPlayersHref(defaults)).toBe("/players");
  });

  it("omits default sort and dir but includes non-default values", () => {
    expect(buildPlayersHref({ ...defaults, sort: "lastName" })).toBe("/players?sort=lastName");
    expect(buildPlayersHref({ ...defaults, dir: "desc" })).toBe("/players");
    expect(buildPlayersHref({ ...defaults, dir: "asc" })).toBe("/players?dir=asc");
    expect(buildPlayersHref({ ...defaults, sort: "lastName", dir: "desc" })).toBe(
      "/players?sort=lastName",
    );
  });

  it("combines all non-default params", () => {
    expect(
      buildPlayersHref({
        q: "curry",
        page: 2,
        size: 25,
        sort: "lastName",
        dir: "desc",
        range: "last5",
        mode: "total",
        minimums: false,
        tab: "regular",
      }),
    ).toBe("/players?q=curry&page=2&size=25&sort=lastName&range=last5&mode=total&minimums=0");
  });

  it("includes a non-default tab and adjusts the omitted default sort per tab", () => {
    expect(buildPlayersHref({ ...defaults, tab: "advanced", sort: "pie" })).toBe(
      "/players?tab=advanced",
    );
    expect(buildPlayersHref({ ...defaults, tab: "advanced", sort: "usagePercentage" })).toBe(
      "/players?tab=advanced&sort=usagePercentage",
    );
    expect(buildPlayersHref({ ...defaults, tab: "fantasy" })).toBe("/players?tab=fantasy");
  });
});

describe("isAdvancedMetricKey", () => {
  it("excludes name keys and regular counting-stat keys, includes advanced metric keys", () => {
    expect(isAdvancedMetricKey("firstName")).toBe(false);
    expect(isAdvancedMetricKey("lastName")).toBe(false);
    expect(isAdvancedMetricKey("pts")).toBe(false);
    expect(isAdvancedMetricKey("pie")).toBe(true);
    expect(isAdvancedMetricKey("usagePercentage")).toBe(true);
  });
});
