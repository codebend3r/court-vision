import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { TEST_WEEK } from "@/components/MatchupView/fixture";
import { StandingsSummary } from "@/components/MatchupView/StandingsSummary";
import { buildStandings } from "@/lib/matchups/standings";

afterEach(cleanup);

describe("StandingsSummary", () => {
  it("says where a team places in each category and flags the best and the worst", () => {
    render(
      <StandingsSummary
        teamName="Team d"
        standings={
          buildStandings({ categories: TEST_WEEK.categories, teams: TEST_WEEK.teams }).get("d") ??
          []
        }
      />,
    );

    const list = screen.getByRole("list");
    const [steals, turnovers] = within(list).getAllByRole("listitem");
    expect(steals?.textContent).toContain("4th");
    expect(steals?.textContent).toContain("of 4");
    expect(steals?.textContent).toContain("Worst in league");
    expect(turnovers?.textContent).toContain("3rd");
    expect(turnovers?.textContent).not.toContain("in league");
  });

  it("flags a best category", () => {
    render(
      <StandingsSummary
        teamName="Team b"
        standings={
          buildStandings({ categories: TEST_WEEK.categories, teams: TEST_WEEK.teams }).get("b") ??
          []
        }
      />,
    );

    expect(screen.getAllByText("Best in league")).toHaveLength(2);
  });
});
