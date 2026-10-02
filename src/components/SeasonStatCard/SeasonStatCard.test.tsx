import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import type { SeasonAverageStat } from "@/lib/players/seasonAverages";

import { SeasonStatCard } from "@/components/SeasonStatCard/SeasonStatCard";

afterEach(cleanup);

const buildStat = (overrides: Partial<SeasonAverageStat> & { key: string }): SeasonAverageStat => ({
  label: overrides.key.toUpperCase(),
  value: "20.0",
  rank: 10,
  rankTone: "leader",
  eligibleCount: 400,
  ...overrides,
});

describe("SeasonStatCard", () => {
  it("renders the season, each stat value, and its NBA rank", () => {
    render(
      <SeasonStatCard
        season="2025-26"
        stats={[
          buildStat({ key: "pts", value: "18.7", rank: 24 }),
          buildStat({ key: "ast", value: "7.7", rank: 3 }),
        ]}
      />,
    );

    expect(screen.getByText("Season averages")).toBeInTheDocument();
    expect(screen.getByText("2025-26")).toBeInTheDocument();
    expect(screen.getByText("18.7")).toBeInTheDocument();
    expect(screen.getByText("24th in NBA")).toBeInTheDocument();
    expect(screen.getByText("7.7")).toBeInTheDocument();
    expect(screen.getByText("3rd in NBA")).toBeInTheDocument();
  });

  it("tiers the rank pills from first through regular", () => {
    render(
      <SeasonStatCard
        season="2025-26"
        stats={[
          buildStat({ key: "ast", rank: 1 }),
          buildStat({ key: "pts", rank: 4 }),
          buildStat({ key: "reb", rank: 15 }),
          buildStat({ key: "tov", rank: 150 }),
        ]}
      />,
    );

    expect(screen.getByText("1st in NBA")).toHaveAttribute("data-tier", "first");
    expect(screen.getByText("4th in NBA")).toHaveAttribute("data-tier", "elite");
    expect(screen.getByText("15th in NBA")).toHaveAttribute("data-tier", "strong");
    expect(screen.getByText("150th in NBA")).toHaveAttribute("data-tier", "regular");
  });

  it("never tints neutral-toned ranks, however high they sit", () => {
    render(
      <SeasonStatCard
        season="2025-26"
        stats={[buildStat({ key: "tov", rank: 1, rankTone: "neutral" })]}
      />,
    );

    expect(screen.getByText("1st in NBA")).toHaveAttribute("data-tier", "regular");
  });

  it("explains the qualified pool in the pill tooltip", () => {
    render(
      <SeasonStatCard
        season="2025-26"
        stats={[buildStat({ key: "pts", rank: 24, eligibleCount: 312 })]}
      />,
    );

    expect(screen.getByText("24th in NBA")).toHaveAttribute(
      "title",
      "24th of 312 qualified players",
    );
  });

  it("lets a caller rename the rank scope and the pool the tooltip describes", () => {
    render(
      <SeasonStatCard
        season="2025-26"
        title="Fantasy value"
        rankScope="in NBA"
        poolNoun="valued players"
        stats={[
          buildStat({
            key: "zscore",
            label: "Z-Score",
            value: "+12.4",
            rank: 2,
            eligibleCount: 480,
          }),
        ]}
      />,
    );

    expect(screen.getByText("Fantasy value")).toBeInTheDocument();
    expect(screen.getByText("2nd in NBA")).toHaveAttribute("title", "2nd of 480 valued players");
  });

  it("gives each card its own heading id so two can share a page", () => {
    render(
      <>
        <SeasonStatCard season="2025-26" stats={[buildStat({ key: "pts" })]} />
        <SeasonStatCard
          season="2025-26"
          title="Advanced stats"
          stats={[buildStat({ key: "pie" })]}
        />
      </>,
    );

    const [first, second] = screen.getAllByRole("region");
    const firstId = first.getAttribute("aria-labelledby") ?? "";
    const secondId = second.getAttribute("aria-labelledby") ?? "";
    expect(firstId).not.toBe("");
    expect(firstId).not.toBe(secondId);
    expect(within(first).getByRole("heading", { level: 2 })).toHaveAttribute("id", firstId);
    expect(within(second).getByRole("heading", { level: 2 })).toHaveAttribute("id", secondId);
  });

  it("renders nothing without stats", () => {
    const { container } = render(<SeasonStatCard season="2025-26" stats={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
