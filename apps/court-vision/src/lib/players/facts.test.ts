import { describe, expect, it } from "bun:test";

import { isPresentFact } from "@/lib/players/facts";

describe("isPresentFact", () => {
  it("accepts a fact with a value", () => {
    expect(isPresentFact({ label: "College", value: "Villanova" })).toBe(true);
  });

  it("rejects a missing or empty value", () => {
    expect(isPresentFact({ label: "College", value: null })).toBe(false);
    expect(isPresentFact({ label: "Country", value: "" })).toBe(false);
  });

  it("narrows a filtered list to printable facts", () => {
    const facts = [
      { label: "Height", value: "6'2\"" },
      { label: "Weight", value: null },
    ].filter(isPresentFact);

    expect(facts).toEqual([{ label: "Height", value: "6'2\"" }]);
    expect(facts.map((fact) => fact.value.length)).toEqual([4]);
  });
});
