import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { StandingsTrendChart } from "@/components/StandingsTrendChart/StandingsTrendChart";
import { type TeamAbbreviation } from "@/components/TeamChip/TeamChip";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

const teams = [
  { abbr: "BOS", name: "Boston Celtics" },
  { abbr: "NYK", name: "New York Knicks" },
] as const;

const rows = [
  { game: 1, BOS: 1, NYK: 0 },
  { game: 2, BOS: 2, NYK: 1 },
];

afterEach(cleanup);

const renderChart = ({
  title,
  rows: chartRows,
  teams: chartTeams = [...teams],
}: {
  title: string;
  rows: typeof rows;
  teams?: ReadonlyArray<{ abbr: TeamAbbreviation; name: string }>;
}) =>
  render(
    <ThemeProvider>
      <StandingsTrendChart title={title} teams={chartTeams} rows={chartRows} />
    </ThemeProvider>,
  );

describe("StandingsTrendChart", () => {
  it("renders nothing without rows", () => {
    const { container } = renderChart({ title: "League", rows: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a legend chip per team and a summary sentence", () => {
    renderChart({ title: "Atlantic", rows });
    expect(screen.getByRole("button", { name: /Boston Celtics/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New York Knicks/ })).toBeInTheDocument();
    expect(
      screen.getByText(/Best record: Boston Celtics, 2 wins through 2 games\./),
    ).toBeInTheDocument();
  });

  it("names each legend button after its team exactly once (TeamChip's own label is hidden)", () => {
    renderChart({ title: "Atlantic", rows });
    expect(screen.getByRole("button", { name: "Boston Celtics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New York Knicks" })).toBeInTheDocument();
  });

  it("mutes a team with zero games in the legend, others unaffected", () => {
    renderChart({
      title: "Atlantic",
      rows,
      teams: [...teams, { abbr: "PHI", name: "Philadelphia 76ers" }],
    });
    expect(screen.getByRole("button", { name: "Boston Celtics" })).not.toHaveAttribute(
      "data-dimmed",
    );
    expect(screen.getByRole("button", { name: "New York Knicks" })).not.toHaveAttribute(
      "data-dimmed",
    );
    expect(screen.getByRole("button", { name: "Philadelphia 76ers" })).toHaveAttribute(
      "data-dimmed",
      "true",
    );
  });

  it("pins a team on click, exposes aria-pressed, and unpins on Escape", () => {
    renderChart({ title: "Atlantic", rows });
    const chip = screen.getByRole("button", { name: /Boston Celtics/ });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(chip, { key: "Escape" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("click-again unpins", () => {
    renderChart({ title: "Atlantic", rows });
    const chip = screen.getByRole("button", { name: /Boston Celtics/ });
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });
});
