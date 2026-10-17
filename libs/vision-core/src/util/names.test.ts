import { describe, expect, it } from "bun:test";

import { nameMatchKey, normalizeName } from "#core/util/names";

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

describe("nameMatchKey", () => {
  it("reduces names that differ only in punctuation and accents to one key", () => {
    expect(nameMatchKey({ name: "A.J. Green" })).toBe(nameMatchKey({ name: "AJ Green" }));
    expect(nameMatchKey({ name: "Egor Dëmin" })).toBe("egor demin");
    expect(nameMatchKey({ name: "Kristaps Porziņģis" })).toBe("kristaps porzingis");
    expect(nameMatchKey({ name: "Wendell Carter Jr." })).toBe("wendell carter jr");
    expect(nameMatchKey({ name: "  De'Aaron   Fox " })).toBe("deaaron fox");
  });
});
