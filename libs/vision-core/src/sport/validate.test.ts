import { describe, expect, it } from "bun:test";

import { basketballFixture } from "#core/testing/basketball";
import { describeSportIssues } from "#core/sport/validate";

describe("describeSportIssues", () => {
  it("finds nothing wrong with a consistent descriptor", () => {
    expect(describeSportIssues({ sport: basketballFixture })).toEqual([]);
  });

  it("reports a category missing from the table order", () => {
    const sport = { ...basketballFixture, categoryOrder: basketballFixture.categoryOrder.slice(1) };
    expect(describeSportIssues({ sport })).toContain(
      'category "pts" is missing from categoryOrder',
    );
  });

  it("reports a stat a category reads that no line carries", () => {
    const sport = {
      ...basketballFixture,
      valuedStats: basketballFixture.valuedStats.filter((key) => key !== "fga"),
    };
    expect(describeSportIssues({ sport })).toContain('stat "fga" is read but not in valuedStats');
  });

  it("reports a slot that defaults above its own ceiling", () => {
    const sport = {
      ...basketballFixture,
      slots: basketballFixture.slots.map((slot) =>
        slot.type === "UTIL" ? { ...slot, defaultCount: 9 } : slot,
      ),
    };
    expect(describeSportIssues({ sport })).toContain('slot "UTIL" defaults above its max (9 > 6)');
  });
});
