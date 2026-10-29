import { describe, expect, it } from "bun:test";

import { TEST_SEASON, TEST_WEEK } from "@/components/MatchupView/fixture";
import { buildSeasonSummary, findMatchup, pickWeek } from "@/lib/matchups/season";

describe("findMatchup", () => {
  it("finds my team and my opponent from either side of the pairing", () => {
    expect(findMatchup({ week: TEST_WEEK, myTeamId: "a" }).opponent?.teamId).toBe("b");
    expect(findMatchup({ week: TEST_WEEK, myTeamId: "b" }).opponent?.teamId).toBe("a");
  });

  it("has no opponent on a bye", () => {
    const { mine, opponent } = findMatchup({
      week: { ...TEST_WEEK, pairings: [] },
      myTeamId: "a",
    });
    expect(mine?.teamId).toBe("a");
    expect(opponent).toBeUndefined();
  });
});

describe("buildSeasonSummary", () => {
  const summary = buildSeasonSummary({ season: TEST_SEASON, myTeamId: "a" });

  it("gives each week its score and outcome", () => {
    expect(
      summary.weeks.map(({ week, wins, losses, outcome }) => [week, wins, losses, outcome]),
    ).toEqual([
      [1, 2, 0, "won"],
      [2, 0, 2, "lost"],
      [3, 0, 2, "in_progress"],
    ]);
    expect(summary.weeks[0]?.opponent?.teamId).toBe("b");
  });

  it("counts only final weeks in the record", () => {
    expect(summary.record).toEqual({ won: 1, lost: 1, tied: 0 });
    expect(summary.finalWeeks).toBe(2);
  });

  it("gives each category its record, weekly average and average rank over final weeks", () => {
    const [steals, turnovers] = summary.categories;
    // Week 1: 40 steals, 1st of 4. Week 2: 20 steals, 3rd of 4.
    expect(steals).toMatchObject({
      wins: 1,
      losses: 1,
      ties: 0,
      weeklyAverage: 30,
      averageRank: 2,
    });
    // Week 1: 30 turnovers, 1st. Week 2: 50 turnovers, 2nd (lower wins).
    expect(turnovers).toMatchObject({ wins: 1, losses: 1, weeklyAverage: 40, averageRank: 1.5 });
  });

  it("marks a bye, an upcoming week and a tie", () => {
    const tiedTeams = TEST_WEEK.teams.map((team) =>
      team.teamId === "a" ? { ...team, values: { "17": 35, "19": 40 } } : team,
    );
    const { weeks } = buildSeasonSummary({
      season: [
        { ...TEST_WEEK, week: 1, status: "postevent", pairings: [] },
        { ...TEST_WEEK, week: 2, status: "postevent", teams: tiedTeams },
        { ...TEST_WEEK, week: 3, status: "preevent" },
      ],
      myTeamId: "a",
    });
    expect(weeks.map(({ outcome }) => outcome)).toEqual(["bye", "tied", "upcoming"]);
  });

  it("has nothing to average before a week is final", () => {
    const { categories, record } = buildSeasonSummary({
      season: [TEST_WEEK],
      myTeamId: "a",
    });
    expect(record).toEqual({ won: 0, lost: 0, tied: 0 });
    expect(categories[0]).toMatchObject({ wins: 0, weeklyAverage: null, averageRank: null });
  });
});

describe("pickWeek", () => {
  it("picks the asked-for week, else the latest", () => {
    expect(pickWeek({ season: TEST_SEASON, week: 1 })?.week).toBe(1);
    expect(pickWeek({ season: TEST_SEASON, week: 9 })?.week).toBe(3);
    expect(pickWeek({ season: TEST_SEASON, week: null })?.week).toBe(3);
    expect(pickWeek({ season: [], week: null })).toBeUndefined();
  });
});
