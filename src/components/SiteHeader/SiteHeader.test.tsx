import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import { SiteHeader } from "./SiteHeader";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  window.localStorage.clear();
});

describe("SiteHeader", () => {
  it("renders the Court Vision wordmark linking home", () => {
    render(
      <ThemeProvider>
        <SiteHeader />
      </ThemeProvider>,
    );
    const wordmark = screen.getByRole("link", { name: "Court Vision" });
    expect(wordmark).toHaveAttribute("href", "/");
  });

  it("renders the theme toggle", () => {
    render(
      <ThemeProvider>
        <SiteHeader />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });
});
