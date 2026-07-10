import { describe, expect, it } from "vitest";

import { normalizeName } from "./names";

describe("normalizeName", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeName("Luka Dončić")).toBe("luka doncic");
  });

  it("matches an already-plain name to its diacritic form", () => {
    expect(normalizeName("Luka Doncic")).toBe(normalizeName("Luka Dončić"));
  });

  it("is a no-op on names without diacritics or casing", () => {
    expect(normalizeName("anthony edwards")).toBe("anthony edwards");
  });
});
