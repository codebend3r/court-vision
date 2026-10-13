import { describe, expect, it } from "bun:test";

import { THEMES, THEME_META, isTheme } from "#ui/theme/themes";

describe("isTheme", () => {
  it("accepts every registered theme", () => {
    THEMES.map((theme) => expect(isTheme(theme)).toBe(true));
  });

  it("rejects unknown strings", () => {
    expect(isTheme("sepia")).toBe(false);
    expect(isTheme("")).toBe(false);
    expect(isTheme("DARK")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(3)).toBe(false);
    expect(isTheme(["dark"])).toBe(false);
  });
});

describe("THEME_META", () => {
  it("covers every theme exactly once, in registry order", () => {
    expect(THEME_META.map((meta) => meta.id)).toEqual([...THEMES]);
  });

  it("tones only the light theme light, matching each block's color-scheme", () => {
    expect(THEME_META.filter((meta) => meta.tone === "light").map((meta) => meta.id)).toEqual([
      "light",
    ]);
  });
});
