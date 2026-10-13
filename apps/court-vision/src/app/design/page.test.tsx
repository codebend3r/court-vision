import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { NBA_TEAMS } from "@/lib/teams/meta";
import { ThemeProvider } from "@vision/ui/components/ThemeProvider/ThemeProvider";

import DesignPage from "@/app/design/page";

afterEach(cleanup);

const renderPage = () =>
  render(
    <ThemeProvider>
      <DesignPage />
    </ThemeProvider>,
  );

const SECTION_LINKS = [
  ["Colors", "#colors"],
  ["Chart palettes", "#chart-palettes"],
  ["Team chips", "#team-chips"],
  ["Typography", "#typography"],
  ["Typefaces", "#typefaces"],
  ["Headings", "#headings"],
  ["Font weights", "#font-weights"],
  ["Body text", "#body-text"],
  ["Spacing", "#spacing"],
  ["Radius", "#radius"],
  ["Form controls", "#form-controls"],
  ["Buttons", "#buttons"],
];

describe("DesignPage", () => {
  it("opens with the page header as its one h1", () => {
    renderPage();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Design system" })).toBeInTheDocument();
  });

  it("links to every design system section, each of which exists", () => {
    renderPage();

    const nav = screen.getByRole("navigation", { name: "Design system sections" });
    const links = within(nav).getAllByRole("link");

    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(
      SECTION_LINKS,
    );
    links.map((link) =>
      expect(document.querySelector(link.getAttribute("href") ?? "")).toBeInTheDocument(),
    );
  });

  it("titles every section with an h2 named like its nav link", () => {
    renderPage();

    SECTION_LINKS.map(([label]) =>
      expect(screen.getByRole("heading", { level: 2, name: label })).toBeInTheDocument(),
    );
  });

  it("catalogs one specimen per keycap mixin, standalone and in groups", () => {
    renderPage();

    ["Keycap", "Engaged", "Danger", "Press"].map((name) =>
      expect(screen.getByRole("button", { name })).toBeInTheDocument(),
    );
    expect(screen.getByRole("group", { name: "Toggle group" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Action group" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Pager group" })).toBeInTheDocument();
    // Only the toggle specimen shows a pressed state.
    expect(screen.getAllByRole("button", { name: "Pressed", pressed: true })).toHaveLength(1);
  });

  it("renders regular, bold, and italic body-text specimens", () => {
    renderPage();

    expect(screen.getByText("Regular weight, roman")).toBeInTheDocument();
    expect(screen.getByText("Bold weight")).toBeInTheDocument();
    expect(screen.getByText("Italic style")).toBeInTheDocument();
    expect(screen.getByText("Bold and italic")).toBeInTheDocument();
  });

  it("renders a chip for every NBA team", () => {
    renderPage();

    const chips = NBA_TEAMS.map((team) => screen.getByTitle(team.name));

    expect(chips).toHaveLength(30);
    expect(screen.getByText("TOR")).toBeInTheDocument();
    expect(screen.getByText("GSW")).toBeInTheDocument();
  });

  it("renders both typeface family names in the typeface and weight sections", () => {
    renderPage();

    expect(screen.getAllByText("Chakra Petch — display")).toHaveLength(2);
    expect(screen.getAllByText("IBM Plex Sans — body")).toHaveLength(2);
  });

  it("renders all 8 color token names", () => {
    renderPage();

    [
      "--color-bg",
      "--color-surface",
      "--color-border",
      "--color-text",
      "--color-text-muted",
      "--color-accent",
      "--color-accent-strong",
      "--color-highlight",
    ].map((token) => expect(screen.getByText(token)).toBeInTheDocument());
  });

  it("renders the h1 specimen without a second h1, then one heading sample per level h2 to h5", () => {
    renderPage();

    const headings = within(
      screen.getByRole("heading", { name: "Headings" }).closest("section") ?? document.body,
    );
    const samples = headings.getAllByText("Fourth quarter comeback");
    expect(samples.map((sample) => sample.tagName)).toEqual(["P", "H2", "H3", "H4", "H5"]);
  });

  it("renders font weight samples for both families", () => {
    renderPage();

    expect(screen.getByText("--font-weight-bold (700)")).toBeInTheDocument();
    expect(screen.getByText("--font-weight-semibold (600)")).toBeInTheDocument();
    expect(screen.getAllByText("--font-weight-regular (400)")).toHaveLength(2);
    expect(screen.getAllByText("--font-weight-medium (500)")).toHaveLength(2);
    expect(screen.getAllByText("Triple double: 32 pts, 11 reb, 10 ast")).toHaveLength(6);
  });

  it("renders the form control specimens", () => {
    renderPage();

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
