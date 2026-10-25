import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { TEST_WEEK } from "@/components/MatchupView/fixture";
import { LeagueTotalsTable } from "@/components/MatchupView/LeagueTotalsTable";

afterEach(cleanup);

const teamOrder = (): string[] =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map(
      (row) => /Team [a-d]/.exec(within(row).getByRole("rowheader").textContent ?? "")?.[0] ?? "",
    );

describe("LeagueTotalsTable", () => {
  it("shows every team's total beside the place it earns", () => {
    render(<LeagueTotalsTable week={TEST_WEEK} />);

    expect(screen.getAllByRole("row")).toHaveLength(5);
    const rowOfB = screen.getByRole("row", { name: /Team b/ });
    expect(within(rowOfB).getByText("35")).toBeInTheDocument();
    expect(within(rowOfB).getByText("40")).toBeInTheDocument();
  });

  it("marks my team for screen readers", () => {
    render(<LeagueTotalsTable week={TEST_WEEK} />);

    expect(screen.getByText("Your team:", { exact: false })).toBeInTheDocument();
  });

  it("tags my row and my opponent's row", () => {
    render(<LeagueTotalsTable week={TEST_WEEK} opponentId="d" />);

    const sides = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.getAttribute("data-side"));
    expect(sides.filter((side) => side === "mine")).toHaveLength(1);
    expect(sides.filter((side) => side === "opponent")).toHaveLength(1);
    expect(screen.getByText("Your opponent:", { exact: false })).toBeInTheDocument();
  });

  it("sorts a category best first, then worst first", () => {
    render(<LeagueTotalsTable week={TEST_WEEK} />);

    fireEvent.click(screen.getByRole("button", { name: "ST" }));
    expect(teamOrder()).toEqual(["Team b", "Team c", "Team a", "Team d"]);

    fireEvent.click(screen.getByRole("button", { name: "ST" }));
    expect(teamOrder().at(-1)).toBe("Team b");
  });

  it("puts the fewest turnovers first, since lower is better there", () => {
    render(<LeagueTotalsTable week={TEST_WEEK} />);

    fireEvent.click(screen.getByRole("button", { name: "TO" }));

    expect(teamOrder()).toEqual(["Team b", "Team a", "Team d", "Team c"]);
  });

  it("names the best and worst places in words", () => {
    render(<LeagueTotalsTable week={TEST_WEEK} />);

    expect(screen.getAllByText("(best in league)", { exact: false })).toHaveLength(2);
    expect(screen.getAllByText("(worst in league)", { exact: false })).toHaveLength(2);
  });
});
