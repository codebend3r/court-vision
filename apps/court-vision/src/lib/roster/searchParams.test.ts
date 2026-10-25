import { describe, expect, it } from "bun:test";

import { buildRosterHref, parseRosterParams } from "@/lib/roster/searchParams";

describe("parseRosterParams", () => {
  it("defaults to the regular tab, the whole season, per game", () => {
    expect(parseRosterParams({ raw: {} })).toEqual({
      tab: "regular",
      range: "all",
      mode: "average",
      team: null,
    });
  });

  it("reads each key", () => {
    expect(parseRosterParams({ raw: { tab: "advanced", range: "last10", mode: "total" } })).toEqual(
      { tab: "advanced", range: "last10", mode: "total", team: null },
    );
  });

  it("falls back to the default for a value it does not know", () => {
    expect(parseRosterParams({ raw: { tab: "starred", range: "last7" } })).toMatchObject({
      tab: "regular",
      range: "all",
    });
  });
});

describe("buildRosterHref", () => {
  it("leaves defaults out of the URL", () => {
    expect(buildRosterHref({ tab: "regular", range: "all", mode: "average", team: null })).toBe(
      "/roster",
    );
  });

  it("keeps the rest in a fixed order", () => {
    expect(buildRosterHref({ tab: "fantasy", range: "last5", mode: "total", team: null })).toBe(
      "/roster?tab=fantasy&range=last5&mode=total",
    );
  });

  it("carries a league-mate's team slug", () => {
    expect(
      buildRosterHref({ tab: "regular", range: "all", mode: "average", team: "5-assassins" }),
    ).toBe("/roster?team=5-assassins");
  });
});
