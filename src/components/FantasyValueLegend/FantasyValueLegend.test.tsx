import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FantasyValueLegend } from "@/components/FantasyValueLegend/FantasyValueLegend";
import { FANTASY_METHODS } from "@/lib/valuation/registry";

afterEach(cleanup);

const openLegend = (container: HTMLElement): HTMLDetailsElement => {
  const details = container.querySelector("details");
  if (!(details instanceof HTMLDetailsElement)) {
    throw new Error("legend <details> not rendered");
  }
  details.open = true;
  return details;
};

describe("FantasyValueLegend", () => {
  it("renders the disclosure summary", () => {
    render(<FantasyValueLegend poolSize={156} windowLabel="All games" basis="perGame" />);
    expect(screen.getByText("How is value calculated?")).toBeInTheDocument();
  });

  it("explains every registry method plus the pool and weights", () => {
    const { container } = render(
      <FantasyValueLegend poolSize={156} windowLabel="Last 10 games" basis="total" />,
    );
    const details = openLegend(container);
    FANTASY_METHODS.forEach((method) => {
      expect(within(details).getByText(`${method.fullName}.`)).toBeInTheDocument();
    });
    expect(within(details).getByText(/156/)).toBeInTheDocument();
    expect(within(details).getByText(/Last 10 games/)).toBeInTheDocument();
    expect(within(details).getByText(/standings-gain denominators/i)).toBeInTheDocument();
    expect(within(details).getByText(/Points ignores weights/)).toBeInTheDocument();
  });
});
