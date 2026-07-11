import { describe, expect, it } from "vitest";

import { buildPlayersHref, parsePlayersSearchParams } from "@/lib/players/searchParams";

describe("parsePlayersSearchParams", () => {
  it("returns defaults for empty input", () => {
    expect(parsePlayersSearchParams({})).toEqual({
      q: "",
      page: 1,
      size: 50,
      includeRetired: false,
      sort: "firstName",
      dir: "desc",
      range: "all",
      mode: "average",
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
    [{ retired: "1" }, { includeRetired: true }],
    [{ retired: "true" }, { includeRetired: false }],
    [{ sort: "lastName" }, { sort: "lastName" }],
    [{ sort: "firstName" }, { sort: "firstName" }],
    [{ sort: "teamAbbr" }, { sort: "firstName" }],
    [{ sort: "" }, { sort: "firstName" }],
    [{ dir: "desc" }, { dir: "desc" }],
    [{ dir: "asc" }, { dir: "asc" }],
    [{ dir: "up" }, { dir: "desc" }],
    [{ range: "last5" }, { range: "last5" }],
    [{ range: "last20" }, { range: "last20" }],
    [{ range: "10" }, { range: "all" }],
    [{ mode: "total" }, { mode: "total" }],
    [{ mode: "perGame" }, { mode: "average" }],
  ])("normalizes %j", (raw, expected) => {
    expect(parsePlayersSearchParams(raw)).toMatchObject(expected);
  });
});

describe("buildPlayersHref", () => {
  const defaults = {
    q: "",
    page: 1,
    size: 50,
    includeRetired: false,
    sort: "firstName",
    dir: "desc",
    range: "all",
    mode: "average",
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
        includeRetired: true,
        sort: "lastName",
        dir: "desc",
        range: "last5",
        mode: "total",
      }),
    ).toBe("/players?q=curry&page=2&size=25&retired=1&sort=lastName&range=last5&mode=total");
  });
});
