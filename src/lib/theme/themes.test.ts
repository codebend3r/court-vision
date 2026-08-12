import { describe, expect, it } from "bun:test";

import { THEMES, THEME_META, isTheme } from "@/lib/theme/themes";

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

  it("holds six-digit hex samples so swatches render without the token layer", () => {
    THEME_META.map((meta) =>
      [meta.bg, meta.surface, meta.accent, meta.accentStrong, meta.text].map((color) =>
        expect(color).toMatch(/^#[0-9a-f]{6}$/),
      ),
    );
  });
});
