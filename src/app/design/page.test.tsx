import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import DesignPage from "@/app/design/page";

afterEach(cleanup);

describe("DesignPage", () => {
  it("links to every design system section", () => {
    render(
      <ThemeProvider>
        <DesignPage />
      </ThemeProvider>,
    );

    const nav = screen.getByRole("navigation", { name: "Design system sections" });
    const links = Array.from(nav.querySelectorAll("a"));

    expect(links).toHaveLength(10);
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Colors", "#colors"],
      ["Chart palettes", "#chart-palettes"],
      ["Team chips", "#team-chips"],
      ["Typography", "#typography"],
      ["Typefaces", "#typefaces"],
      ["Headings", "#headings"],
      ["Font weights", "#font-weights"],
      ["Spacing", "#spacing"],
      ["Radius", "#radius"],
      ["Form controls", "#form-controls"],
    ]);

    for (const link of links) {
      expect(document.querySelector(link.getAttribute("href") ?? "")).toBeInTheDocument();
    }
  });

  it("renders the ten section headings", () => {
    render(
      <ThemeProvider>
        <DesignPage />
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Colors" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chart palettes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Team chips" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Typography" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Typefaces" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Headings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Font weights" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Spacing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Radius" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Form controls" })).toBeInTheDocument();
  });

  it("renders a chip for every NBA team", () => {
    render(
      <ThemeProvider>
        <DesignPage />
      </ThemeProvider>,
    );

    expect(screen.getAllByRole("img", { name: / colors$/ })).toHaveLength(30);
    expect(screen.getByText("Toronto Raptors")).toBeInTheDocument();
    expect(screen.getByText("Golden State Warriors")).toBeInTheDocument();
  });

  it("renders both typeface family names in the typeface and weight sections", () => {
    render(
      <ThemeProvider>
        <DesignPage />
      </ThemeProvider>,
    );

    expect(screen.getAllByText("Chakra Petch — display")).toHaveLength(2);
    expect(screen.getAllByText("IBM Plex Sans — body")).toHaveLength(2);
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

  it("renders one heading sample per level h1 to h5", () => {
    render(
      <ThemeProvider>
        <DesignPage />
      </ThemeProvider>,
    );

    const samples = screen.getAllByRole("heading", { name: "Fourth quarter comeback" });
    const levels = samples.map((sample) => sample.tagName);
    expect(levels).toEqual(["H1", "H2", "H3", "H4", "H5"]);
  });

  it("renders font weight samples for both families", () => {
    render(
      <ThemeProvider>
        <DesignPage />
      </ThemeProvider>,
    );

    expect(screen.getByText("--font-weight-bold (700)")).toBeInTheDocument();
    expect(screen.getByText("--font-weight-semibold (600)")).toBeInTheDocument();
    expect(screen.getAllByText("--font-weight-regular (400)")).toHaveLength(2);
    expect(screen.getAllByText("--font-weight-medium (500)")).toHaveLength(2);
    expect(screen.getAllByText("Triple double: 32 pts, 11 reb, 10 ast")).toHaveLength(6);
  });

  it("renders the form control specimens", () => {
    render(
      <ThemeProvider>
        <DesignPage />
      </ThemeProvider>,
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getAllByRole("switch")).toHaveLength(3);
    expect(screen.getByRole("switch", { name: "On" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Disabled" })).toBeDisabled();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save lineup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview stats" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear form" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Scouting notes")).toBeInTheDocument();
  });
});
