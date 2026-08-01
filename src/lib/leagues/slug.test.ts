import { describe, expect, it } from "bun:test";

import { uniqueSlug } from "@/lib/leagues/slug";

describe("uniqueSlug", () => {
  it("returns the base when free", () => {
    expect(uniqueSlug({ base: "my-league", taken: [] })).toBe("my-league");
  });
  it("suffixes from -2 upward when taken", () => {
    expect(uniqueSlug({ base: "my-league", taken: ["my-league"] })).toBe("my-league-2");
    expect(uniqueSlug({ base: "my-league", taken: ["my-league", "my-league-2"] })).toBe(
      "my-league-3",
    );
  });
});
