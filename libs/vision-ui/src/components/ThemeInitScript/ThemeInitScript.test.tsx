import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { ThemeInitScript, themeInitSource } from "#ui/components/ThemeInitScript/ThemeInitScript";
import { THEMES } from "#ui/theme/themes";

afterEach(cleanup);

describe("themeInitSource", () => {
  it("accepts exactly the registered themes", () => {
    expect(themeInitSource()).toContain(`var ok=${JSON.stringify(THEMES)};`);
  });

  it("stamps the stored theme, or falls back to the system preference", () => {
    window.localStorage.setItem("theme", "amber-crt");
    new Function(themeInitSource())();
    expect(document.documentElement.dataset.theme).toBe("amber-crt");

    window.localStorage.setItem("theme", "not-a-theme");
    new Function(themeInitSource())();
    expect(["light", "dark"]).toContain(document.documentElement.dataset.theme ?? "");
  });
});

describe("ThemeInitScript", () => {
  it("renders the init source as an inline script", () => {
    const { container } = render(<ThemeInitScript />);
    expect(container.querySelector("script")?.innerHTML).toBe(themeInitSource());
  });
});
