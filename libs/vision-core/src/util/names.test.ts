import { describe, expect, it } from "bun:test";

import { normalizeName } from "#core/util/names";

describe("normalizeName", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeName({ name: "Luka Dončić" })).toBe("luka doncic");
  });

  it("matches an already-plain name to its diacritic form", () => {
    expect(normalizeName({ name: "Luka Doncic" })).toBe(normalizeName({ name: "Luka Dončić" }));
  });

  it("is a no-op on names without diacritics or casing", () => {
    expect(normalizeName({ name: "anthony edwards" })).toBe("anthony edwards");
  });
});
