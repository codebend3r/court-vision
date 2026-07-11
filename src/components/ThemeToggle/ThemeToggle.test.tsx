import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  window.localStorage.clear();
});

describe("ThemeToggle", () => {
  it("labels the button to switch to light theme while dark is active", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("flips the html attribute and the label on click", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
  });

  it("labels the button to switch to dark theme once mounted with a pre-stamped light attribute", () => {
    document.documentElement.dataset.theme = "light";

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
  });

  it("renders a neutral aria-label and no themed text in SSR markup", () => {
    const html = renderToString(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(html).toContain('aria-label="Toggle theme"');
    expect(html).not.toContain("Switch to");
  });

  it("produces identical SSR markup regardless of a pre-stamped theme attribute", () => {
    const htmlWithoutStamp = renderToString(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    document.documentElement.dataset.theme = "light";

    const htmlWithStamp = renderToString(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(htmlWithStamp).toBe(htmlWithoutStamp);
  });
});
