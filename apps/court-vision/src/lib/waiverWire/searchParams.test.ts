import { describe, expect, it } from "bun:test";

import { loadWaiverWireSearchParams } from "@/lib/waiverWire/searchParams";

describe("loadWaiverWireSearchParams", () => {
  it("defaults to the swap board over the season", () => {
    expect(loadWaiverWireSearchParams({})).toEqual({
      view: "swap",
      range: "all",
      pos: "all",
      scope: "all",
      fa: null,
      mine: null,
    });
  });

  it("reads a chosen view, range, position and scope", () => {
    expect(
      loadWaiverWireSearchParams({ view: "cut", range: "last20", pos: "G", scope: "fa" }),
    ).toMatchObject({ view: "cut", range: "last20", pos: "G", scope: "fa" });
  });

  it("drops unknown views and positions", () => {
    expect(
      loadWaiverWireSearchParams({ view: "trade", pos: "PG", scope: "none", range: "last7" }),
    ).toMatchObject({ view: "swap", pos: "all", scope: "all", range: "all" });
  });

  it("reads player ids as integers", () => {
    expect(loadWaiverWireSearchParams({ fa: "201939", mine: "7" })).toMatchObject({
      fa: 201939,
      mine: 7,
    });
    expect(loadWaiverWireSearchParams({ fa: "abc" }).fa).toBeNull();
  });
});
