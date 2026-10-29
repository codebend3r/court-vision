import { describe, expect, it, vi } from "bun:test";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { toLeagueSeason, toLeagueWeek } = await import("@/lib/matchups/loader");

const CATEGORIES = [
  { statId: 5, displayName: "FG%", higherIsBetter: true },
  { statId: 19, displayName: "TO", higherIsBetter: false },
];

const TEAMS = [
  { id: "t1", name: "One", slug: "one", logoUrl: null, managerName: "Kim" },
  { id: "t2", name: "Two", slug: "two", logoUrl: null, managerName: null },
];

const MATCHUP = {
  syncedAt: new Date("2026-11-04T12:00:00Z"),
  week: 3,
  weekStart: "2026-11-03",
  weekEnd: "2026-11-09",
  status: "midevent",
  teamAId: "t1",
  teamBId: "t2",
  statsA: { "5": ".481", "19": "61" },
  statsB: { "5": "-", "19": "55" },
};

describe("toLeagueWeek", () => {
  it("builds the week with parsed totals and my team flagged", () => {
    const week = toLeagueWeek({
      statCategories: CATEGORIES,
      matchups: [MATCHUP],
      teams: TEAMS,
      myTeamId: "t1",
    });

    expect(week).toMatchObject({
      syncedAt: "2026-11-04T12:00:00.000Z",
      week: 3,
      weekStart: "2026-11-03",
      categories: [
        { statId: 5, label: "FG%", higherIsBetter: true },
        { statId: 19, label: "TO", higherIsBetter: false },
      ],
      pairings: [{ teamAId: "t1", teamBId: "t2" }],
    });
    expect(week?.teams.map(({ teamId, isMine }) => [teamId, isMine])).toEqual([
      ["t1", true],
      ["t2", false],
    ]);
    expect(week?.teams[0]?.values).toEqual({ "5": 0.481, "19": 61 });
    expect(week?.teams[1]?.display["5"]).toBe("-");
    expect(week?.teams[1]?.values["5"]).toBeNull();
  });

  it("keeps bye teams in the league totals without inventing a pairing", () => {
    const week = toLeagueWeek({
      statCategories: CATEGORIES,
      matchups: [{ ...MATCHUP, teamBId: null, statsB: {} }],
      teams: TEAMS,
      myTeamId: "t1",
    });
    expect(week?.teams.map(({ teamId }) => teamId)).toEqual(["t1"]);
    expect(week?.teams[0]?.values["19"]).toBe(61);
    expect(week?.pairings).toEqual([]);
  });

  it("does not invent freshness for rows stored before timestamps were tracked", () => {
    const week = toLeagueWeek({
      statCategories: CATEGORIES,
      matchups: [{ ...MATCHUP, syncedAt: null }],
      teams: TEAMS,
      myTeamId: null,
    });
    expect(week?.syncedAt).toBeNull();
  });

  it("is null before any matchup is stored", () => {
    expect(
      toLeagueWeek({ statCategories: CATEGORIES, matchups: [], teams: TEAMS, myTeamId: "t1" }),
    ).toBeNull();
  });

  it("is null when the categories were never stored or are malformed", () => {
    expect(
      toLeagueWeek({ statCategories: null, matchups: [MATCHUP], teams: TEAMS, myTeamId: "t1" }),
    ).toBeNull();
    expect(
      toLeagueWeek({
        statCategories: [{ nope: 1 }],
        matchups: [MATCHUP],
        teams: TEAMS,
        myTeamId: null,
      }),
    ).toBeNull();
  });

  it("reads malformed totals as none and skips a team that is gone", () => {
    const week = toLeagueWeek({
      statCategories: CATEGORIES,
      matchups: [{ ...MATCHUP, statsA: "garbage", teamBId: "gone" }],
      teams: TEAMS,
      myTeamId: null,
    });

    expect(week?.teams).toHaveLength(1);
    expect(week?.teams[0]?.display).toEqual({});
  });
});

describe("toLeagueSeason", () => {
  it("builds one week per stored week, oldest first", () => {
    const season = toLeagueSeason({
      statCategories: CATEGORIES,
      matchups: [
        { ...MATCHUP, week: 3 },
        { ...MATCHUP, week: 1, status: "postevent" },
        { ...MATCHUP, week: 2, status: "postevent" },
      ],
      teams: TEAMS,
      myTeamId: "t1",
    });
    expect(season.map(({ week, status }) => [week, status])).toEqual([
      [1, "postevent"],
      [2, "postevent"],
      [3, "midevent"],
    ]);
  });

  it("keeps each week's own matchups apart", () => {
    const season = toLeagueSeason({
      statCategories: CATEGORIES,
      matchups: [
        { ...MATCHUP, week: 1, statsA: { "5": ".400" } },
        { ...MATCHUP, week: 2, statsA: { "5": ".500" } },
      ],
      teams: TEAMS,
      myTeamId: "t1",
    });
    expect(season.map((week) => week.teams[0]?.values["5"])).toEqual([0.4, 0.5]);
    expect(season.every((week) => week.teams.length === 2)).toBe(true);
  });

  it("is empty with no matchups or no categories", () => {
    expect(
      toLeagueSeason({ statCategories: CATEGORIES, matchups: [], teams: TEAMS, myTeamId: "t1" }),
    ).toEqual([]);
    expect(
      toLeagueSeason({ statCategories: null, matchups: [MATCHUP], teams: TEAMS, myTeamId: "t1" }),
    ).toEqual([]);
  });
});
