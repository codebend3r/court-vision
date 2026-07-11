import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import DesignPage from "./page";

afterEach(cleanup);

describe("DesignPage", () => {
  it("renders the six section headings", () => {
    render(
      <ThemeProvider>
        <DesignPage />
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Colors" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chart palettes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Typography" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Typefaces" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Spacing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Radius" })).toBeInTheDocument();
  });

  it("renders both typeface family names", () => {
    render(
      <ThemeProvider>
        <DesignPage />
      </ThemeProvider>,
    );

    expect(screen.getByText("Chakra Petch — display")).toBeInTheDocument();
    expect(screen.getByText("IBM Plex Sans — body")).toBeInTheDocument();
  });

  it("renders all 8 color token names", () => {
    render(
      <ThemeProvider>
        <DesignPage />
      </ThemeProvider>,
    );

    expect(screen.getByText("--color-bg")).toBeInTheDocument();
    expect(screen.getByText("--color-surface")).toBeInTheDocument();
    expect(screen.getByText("--color-border")).toBeInTheDocument();
    expect(screen.getByText("--color-text")).toBeInTheDocument();
    expect(screen.getByText("--color-text-muted")).toBeInTheDocument();
    expect(screen.getByText("--color-accent")).toBeInTheDocument();
    expect(screen.getByText("--color-accent-strong")).toBeInTheDocument();
    expect(screen.getByText("--color-highlight")).toBeInTheDocument();
  });
});
