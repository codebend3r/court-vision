import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { TEST_WEEK } from "@/components/MatchupView/fixture";
import { MatchupPanel } from "@/components/MatchupView/MatchupPanel";

afterEach(cleanup);

const [mine, opponent] = TEST_WEEK.teams;

describe("MatchupPanel", () => {
  it("names both teams and tallies the week", () => {
    if (!mine || !opponent) throw new Error("fixture");

    render(<MatchupPanel week={TEST_WEEK} mine={mine} opponent={opponent} />);

    const region = screen.getByRole("region", { name: "This week's matchup" });
    expect(within(region).getByText("Team a", { selector: "span" })).toBeInTheDocument();
    expect(within(region).getByText("Team b", { selector: "span" })).toBeInTheDocument();
    expect(within(region).getByText("Kim")).toBeInTheDocument();
    expect(within(region).getByLabelText("0 wins, 2 losses, 0 ties")).toBeInTheDocument();
  });

  it("lists each category with both totals and the result in words", () => {
    if (!mine || !opponent) throw new Error("fixture");

    render(<MatchupPanel week={TEST_WEEK} mine={mine} opponent={opponent} />);

    const steals = screen.getByRole("row", { name: /ST/ });
    expect(
      within(steals)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["20", "35", "Loss"]);
    const turnovers = screen.getByRole("row", { name: /TO/ });
    expect(within(turnovers).getByText("(lower wins)", { exact: false })).toBeInTheDocument();
    expect(within(turnovers).getByText("Loss")).toBeInTheDocument();
  });

  it("calls a winning category a win", () => {
    const [, , c, d] = TEST_WEEK.teams;
    if (!c || !d) throw new Error("fixture");

    render(<MatchupPanel week={TEST_WEEK} mine={c} opponent={d} />);

    expect(within(screen.getByRole("row", { name: /ST/ })).getByText("Win")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /TO/ })).getByText("Loss")).toBeInTheDocument();
  });
});
