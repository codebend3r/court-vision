import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { StatLegend, type StatLegendEntry } from "@/components/StatLegend/StatLegend";

afterEach(cleanup);

const entries: StatLegendEntry[] = [
  {
    key: "ts",
    term: "TS%",
    fullName: "True Shooting Percentage",
    description: "Scoring efficiency.",
    whyItMatters: "Rewards threes and free throws.",
    formula: "PTS ÷ (2 × TSA)",
  },
  { key: "pool", term: "Pool", description: "Who the scores are measured against." },
];

const openLegend = (container: HTMLElement): HTMLDetailsElement => {
  const details = container.querySelector("details");
  if (!(details instanceof HTMLDetailsElement)) throw new Error("legend <details> not rendered");
  details.open = true;
  return details;
};

describe("StatLegend", () => {
  it("folds the glossary under its summary", () => {
    const { container } = render(<StatLegend summary="What do these mean?" entries={entries} />);

    expect(screen.getByText("What do these mean?")).toBeInTheDocument();
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });

  it("names each term and adds the full name, reason and formula only when given", () => {
    const { container } = render(<StatLegend summary="Legend" entries={entries} />);
    const details = within(openLegend(container));

    expect(details.getByText("TS%")).toBeInTheDocument();
    expect(details.getByText("True Shooting Percentage.")).toBeInTheDocument();
    expect(details.getByText("PTS ÷ (2 × TSA)")).toBeInTheDocument();
    expect(details.getAllByText("Why it matters:")).toHaveLength(1);
    expect(details.getByText("Who the scores are measured against.")).toBeInTheDocument();
    expect(details.getAllByRole("code")).toHaveLength(1);
  });

  it("lays the entries out in columns only when asked", () => {
    const { container, rerender } = render(<StatLegend summary="Legend" entries={entries} />);
    expect(container.querySelector("dl")).not.toHaveAttribute("data-columns");

    rerender(<StatLegend summary="Legend" entries={entries} columns />);
    expect(container.querySelector("dl")).toHaveAttribute("data-columns", "true");
  });
});
