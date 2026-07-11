import { describe, expect, it } from "vitest";

import { buildPlayersHref, parsePlayersSearchParams } from "./searchParams";

describe("parsePlayersSearchParams", () => {
  it("returns defaults for empty input", () => {
    expect(parsePlayersSearchParams({})).toEqual({
      q: "",
      page: 1,
      size: 25,
      includeRetired: false,
      sort: "firstName",
      dir: "asc",
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
    [{ size: "33" }, { size: 25 }],
    [{ size: "" }, { size: 25 }],
    [{ retired: "1" }, { includeRetired: true }],
    [{ retired: "true" }, { includeRetired: false }],
    [{ sort: "lastName" }, { sort: "lastName" }],
    [{ sort: "firstName" }, { sort: "firstName" }],
    [{ sort: "teamAbbr" }, { sort: "firstName" }],
    [{ sort: "" }, { sort: "firstName" }],
    [{ dir: "desc" }, { dir: "desc" }],
    [{ dir: "asc" }, { dir: "asc" }],
    [{ dir: "up" }, { dir: "asc" }],
  ])("normalizes %j", (raw, expected) => {
    expect(parsePlayersSearchParams(raw)).toMatchObject(expected);
  });
});

describe("buildPlayersHref", () => {
  const defaults = {
    q: "",
    page: 1,
    size: 25,
    includeRetired: false,
    sort: "firstName",
    dir: "asc",
  } as const;

  it("returns the bare path when everything is default", () => {
    expect(buildPlayersHref(defaults)).toBe("/players");
  });

  it("omits default sort and dir but includes non-default values", () => {
    expect(buildPlayersHref({ ...defaults, sort: "lastName" })).toBe("/players?sort=lastName");
    expect(buildPlayersHref({ ...defaults, dir: "desc" })).toBe("/players?dir=desc");
    expect(buildPlayersHref({ ...defaults, sort: "lastName", dir: "desc" })).toBe(
      "/players?sort=lastName&dir=desc",
    );
  });

  it("combines all non-default params", () => {
    expect(
      buildPlayersHref({
        q: "curry",
        page: 2,
        size: 50,
        includeRetired: true,
        sort: "lastName",
        dir: "desc",
      }),
    ).toBe("/players?q=curry&page=2&size=50&retired=1&sort=lastName&dir=desc");
  });
});
