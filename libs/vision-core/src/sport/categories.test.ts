import { describe, expect, it } from "bun:test";

import { countingCategory } from "#core/sport/categories";
import { type BasketballKeys } from "#core/testing/basketball";

describe("countingCategory", () => {
  it("builds a higher-is-better category that totals its own stat", () => {
    const counting = countingCategory<BasketballKeys>();
    expect(
      counting({
        key: "pts",
        label: "PTS",
        fullName: "Points",
        description: "Scoring contribution relative to the player pool.",
      }),
    ).toEqual({
      kind: "counting",
      key: "pts",
      stat: "pts",
      direction: "higher",
      label: "PTS",
      fullName: "Points",
      description: "Scoring contribution relative to the player pool.",
      formula: "(PTS − pool avg) ÷ pool std dev × weight",
    });
  });
});
