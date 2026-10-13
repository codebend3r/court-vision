import { describe, expect, it } from "bun:test";

import {
  ADVANCED_SORT_KEYS,
  buildPlayersHref,
  defaultSortFor,
  GAME_RANGE_LABELS,
  gamesForRange,
  isAdvancedMetricKey,
  isAdvancedSortKey,
  isPlayerGameRange,
  isPlayersTab,
  isPlayerStatMode,
  listParsers,
  parsePlayersSearchParams,
  parseStarredSearchParams,
  PLAYER_GAME_RANGES,
  PLAYERS_TABS,
} from "@/lib/players/searchParams";

describe("parsePlayersSearchParams", () => {
  it("returns defaults for empty input", () => {
    expect(parsePlayersSearchParams({ raw: {} })).toEqual({
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
    expect(parsePlayersSearchParams({ raw })).toMatchObject(expected);
  });

  it("validates sort against the advanced tab's own key set, defaulting to pie", () => {
    expect(
      parsePlayersSearchParams({ raw: { tab: "advanced", sort: "usagePercentage" } }),
    ).toMatchObject({
      tab: "advanced",
      sort: "usagePercentage",
    });
    expect(parsePlayersSearchParams({ raw: { tab: "advanced", sort: "pts" } })).toMatchObject({
      tab: "advanced",
      sort: "pie",
    });
    expect(parsePlayersSearchParams({ raw: { tab: "advanced", sort: "firstName" } })).toMatchObject(
      {
        tab: "advanced",
        sort: "firstName",
      },
    );
  });

  it("validates sort against the regular tab's own key set, defaulting to pts", () => {
    expect(parsePlayersSearchParams({ raw: { tab: "regular", sort: "pie" } })).toMatchObject({
      tab: "regular",
      sort: "pts",
    });
    expect(parsePlayersSearchParams({ raw: { sort: "pie" } })).toMatchObject({
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
    expect(parsePlayersSearchParams({ raw: { tab: "starred" } }).tab).toBe("starred");
  });

  it("defaults to starredAt, newest first", () => {
    const params = parsePlayersSearchParams({ raw: { tab: "starred" } });
    expect(params.sort).toBe("starredAt");
    expect(params.dir).toBe("desc");
  });

  it("keeps the default sort out of the href", () => {
    const params = parsePlayersSearchParams({ raw: { tab: "starred" } });
    expect(buildPlayersHref(params)).toBe("/players?tab=starred");
  });

  it("still honours an explicit stat sort", () => {
    expect(parsePlayersSearchParams({ raw: { tab: "starred", sort: "pts" } }).sort).toBe("pts");
  });
});

describe("parsePlayersSearchParams raw input", () => {
  it("takes the first value of a repeated key", () => {
    expect(
      parsePlayersSearchParams({ raw: { q: ["curry", "x"], page: ["2", "9"] } }),
    ).toMatchObject({ q: "curry", page: 2 });
  });
});

describe("parseStarredSearchParams", () => {
  it("forces the starred tab and its default sort whatever the query's tab says", () => {
    expect(parseStarredSearchParams({ raw: { tab: "advanced", sort: "pie" } })).toEqual({
      q: "",
      page: 1,
      size: 50,
      sort: "starredAt",
      dir: "desc",
      range: "all",
      mode: "average",
      minimums: true,
      tab: "starred",
    });
  });

  it("honours a regular sort and the shared list keys", () => {
    expect(
      parseStarredSearchParams({ raw: { sort: "pts", dir: "asc", q: [" brunson ", "x"] } }),
    ).toMatchObject({ tab: "starred", sort: "pts", dir: "asc", q: "brunson" });
  });
});

describe("defaultSortFor", () => {
  it("leads each tab with its own default sort", () => {
    expect(defaultSortFor({ tab: "regular" })).toBe("pts");
    expect(defaultSortFor({ tab: "fantasy" })).toBe("pts");
    expect(defaultSortFor({ tab: "advanced" })).toBe("pie");
    expect(defaultSortFor({ tab: "starred" })).toBe("starredAt");
  });
});

describe("GAME_RANGE_LABELS", () => {
  it("names every range", () => {
    expect(PLAYER_GAME_RANGES.map((range) => GAME_RANGE_LABELS[range])).toEqual([
      "All games",
      "Last 5 games",
      "Last 10 games",
      "Last 20 games",
      "Last 40 games",
      "Last 60 games",
    ]);
  });
});

describe("listParsers", () => {
  it("parses the shared list keys the way the players tabs read them", () => {
    expect(listParsers.q.parse("  curry  ")).toBe("curry");
    expect(listParsers.page.parse("0")).toBe(1);
    expect(listParsers.page.parse("abc")).toBeNull();
    expect(listParsers.size.parse("25")).toBe(25);
    expect(listParsers.size.parse("33")).toBeNull();
    expect(listParsers.size.defaultValue).toBe(50);
    expect(listParsers.dir.parse("up")).toBeNull();
    expect(listParsers.range.parse("last10")).toBe("last10");
    expect(listParsers.mode.parse("total")).toBe("total");
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

describe("gamesForRange", () => {
  it("maps a lastN range to N games and the whole season to null", () => {
    expect(gamesForRange({ range: "last5" })).toBe(5);
    expect(gamesForRange({ range: "last60" })).toBe(60);
    expect(gamesForRange({ range: "all" })).toBeNull();
  });
});
