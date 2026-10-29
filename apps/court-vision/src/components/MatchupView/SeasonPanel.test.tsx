import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { TEST_SEASON, TEST_WEEK } from "@/components/MatchupView/fixture";
import { SeasonPanel } from "@/components/MatchupView/SeasonPanel";
import { buildSeasonSummary } from "@/lib/matchups/season";

afterEach(cleanup);

describe("SeasonPanel", () => {
  it("shows the record and every week, each linking to its matchup", () => {
    render(
      <SeasonPanel
        teamName="Team a"
        summary={buildSeasonSummary({ season: TEST_SEASON, myTeamId: "a" })}
      />,
    );

    expect(screen.getByLabelText("1 won, 1 lost, 0 tied")).toBeInTheDocument();
    const weeks = within(screen.getByRole("table", { name: /every week/i })).getAllByRole("row");
    // The header row, then a row per week.
    expect(weeks).toHaveLength(4);
    expect(weeks[1]?.textContent).toContain("Team b");
    expect(weeks[1]?.textContent).toContain("2-0-0");
    expect(weeks[1]?.textContent).toContain("Won");
    expect(weeks[3]?.textContent).toContain("In progress");
    expect(screen.getByRole("link", { name: "Week 1" })).toHaveAttribute("href", "/matchup?week=1");
  });

  it("gives each category its record, average and rank", () => {
    render(
      <SeasonPanel
        teamName="Team a"
        summary={buildSeasonSummary({ season: TEST_SEASON, myTeamId: "a" })}
      />,
    );
    const rows = within(screen.getByRole("table", { name: /categories/i })).getAllByRole("row");
    expect(rows[1]?.textContent).toContain("ST");
    expect(rows[1]?.textContent).toContain("1-1-0");
    expect(rows[1]?.textContent).toContain("30.0");
    expect(rows[1]?.textContent).toContain("2.0");
    expect(rows[2]?.textContent).toContain("(lower wins)");
  });

  it("says when no week is final yet", () => {
    render(
      <SeasonPanel
        teamName="Team a"
        summary={buildSeasonSummary({ season: [TEST_WEEK], myTeamId: "a" })}
      />,
    );
    expect(screen.getByText(/no week is final yet/i)).toBeInTheDocument();
  });
});
