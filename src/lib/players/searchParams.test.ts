import { describe, expect, it } from "bun:test";

import {
  ADVANCED_SORT_KEYS,
  buildPlayersHref,
  isAdvancedMetricKey,
  isAdvancedSortKey,
  isPlayerGameRange,
  isPlayersTab,
  isPlayerStatMode,
  parsePlayersSearchParams,
  PLAYER_GAME_RANGES,
  PLAYERS_TABS,
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

describe("starred tab", () => {
  it("is accepted as a tab", () => {
    expect(parsePlayersSearchParams({ tab: "starred" }).tab).toBe("starred");
  });

  it("defaults to starredAt, newest first", () => {
    const params = parsePlayersSearchParams({ tab: "starred" });
    expect(params.sort).toBe("starredAt");
    expect(params.dir).toBe("desc");
  });

  it("keeps the default sort out of the href", () => {
    const params = parsePlayersSearchParams({ tab: "starred" });
    expect(buildPlayersHref(params)).toBe("/players?tab=starred");
  });

  it("still honours an explicit stat sort", () => {
    expect(parsePlayersSearchParams({ tab: "starred", sort: "pts" }).sort).toBe("pts");
  });
});

// Every one of these narrows a raw query-string value, so an over-permissive
// guard is what lets an unchecked string reach a sort key or a Prisma filter.
describe("isPlayersTab", () => {
  it("accepts each of the four real tabs", () => {
    PLAYERS_TABS.forEach((tab) => {
      expect(isPlayersTab(tab)).toBe(true);
    });
  });

  it("rejects an unknown tab, undefined, and an empty string", () => {
    expect(isPlayersTab("fantasyland")).toBe(false);
    expect(isPlayersTab(undefined)).toBe(false);
    expect(isPlayersTab("")).toBe(false);
  });
});

describe("isAdvancedSortKey", () => {
  it("accepts every advertised advanced sort key", () => {
    ADVANCED_SORT_KEYS.forEach((key) => {
      expect(isAdvancedSortKey(key)).toBe(true);
    });
  });

  it("rejects a regular-tab-only key, undefined, and an empty string", () => {
    expect(isAdvancedSortKey("starredAt")).toBe(false);
    expect(isAdvancedSortKey(undefined)).toBe(false);
    expect(isAdvancedSortKey("")).toBe(false);
  });
});

describe("isPlayerGameRange", () => {
  it("accepts every advertised range", () => {
    PLAYER_GAME_RANGES.forEach((range) => {
      expect(isPlayerGameRange(range)).toBe(true);
    });
  });

  it("rejects an arbitrary window, undefined, and an empty string", () => {
    expect(isPlayerGameRange("last7")).toBe(false);
    expect(isPlayerGameRange(undefined)).toBe(false);
    expect(isPlayerGameRange("")).toBe(false);
  });
});

describe("isPlayerStatMode", () => {
  it("accepts average and total", () => {
    expect(isPlayerStatMode("average")).toBe(true);
    expect(isPlayerStatMode("total")).toBe(true);
  });

  it("rejects the chart's mode vocabulary, undefined, and an empty string", () => {
    expect(isPlayerStatMode("per36")).toBe(false);
    expect(isPlayerStatMode("avg")).toBe(false);
    expect(isPlayerStatMode(undefined)).toBe(false);
    expect(isPlayerStatMode("")).toBe(false);
  });
});
