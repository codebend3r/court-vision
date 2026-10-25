import { describe, expect, it } from "bun:test";

import {
  averageRank,
  compareTotals,
  parseStatValue,
  rankCategory,
  scoreMatchup,
  buildStandings,
} from "@/lib/matchups/standings";
import { type WeekCategory, type WeekTeam } from "@/lib/matchups/types";

const STEALS: WeekCategory = { statId: 17, label: "ST", higherIsBetter: true };
const TURNOVERS: WeekCategory = { statId: 19, label: "TO", higherIsBetter: false };

const team = ({
  teamId,
  steals,
  turnovers,
  isMine = false,
}: {
  teamId: string;
  steals: string;
  turnovers: string;
  isMine?: boolean;
}): WeekTeam => ({
  teamId,
  name: `Team ${teamId}`,
  slug: teamId,
  logoUrl: null,
  managerName: null,
  isMine,
  display: { "17": steals, "19": turnovers },
  values: { "17": parseStatValue({ raw: steals }), "19": parseStatValue({ raw: turnovers }) },
});

const TEAMS = [
  team({ teamId: "a", steals: "20", turnovers: "50", isMine: true }),
  team({ teamId: "b", steals: "35", turnovers: "40" }),
  team({ teamId: "c", steals: "35", turnovers: "70" }),
  team({ teamId: "d", steals: "10", turnovers: "60" }),
];

describe("parseStatValue", () => {
  it("reads whole numbers, rates and negatives", () => {
    expect(parseStatValue({ raw: "412" })).toBe(412);
    expect(parseStatValue({ raw: ".481" })).toBe(0.481);
    expect(parseStatValue({ raw: "0.5" })).toBe(0.5);
    expect(parseStatValue({ raw: "-3" })).toBe(-3);
  });

  it("reads anything that is not one number as null", () => {
    expect(parseStatValue({ raw: "-" })).toBeNull();
    expect(parseStatValue({ raw: "" })).toBeNull();
    expect(parseStatValue({ raw: "42/87" })).toBeNull();
    expect(parseStatValue({ raw: "abc" })).toBeNull();
  });
});

describe("compareTotals", () => {
  it("wins on more when higher is better and on less when it is not", () => {
    expect(compareTotals({ mine: 5, theirs: 3, higherIsBetter: true })).toBe("win");
    expect(compareTotals({ mine: 3, theirs: 5, higherIsBetter: true })).toBe("loss");
    expect(compareTotals({ mine: 3, theirs: 5, higherIsBetter: false })).toBe("win");
    expect(compareTotals({ mine: 5, theirs: 3, higherIsBetter: false })).toBe("loss");
  });

  it("ties on equal totals, nulls included", () => {
    expect(compareTotals({ mine: 4, theirs: 4, higherIsBetter: true })).toBe("tie");
    expect(compareTotals({ mine: null, theirs: null, higherIsBetter: true })).toBe("tie");
  });

  it("loses to a real number when it has none, and beats a team with none", () => {
    expect(compareTotals({ mine: null, theirs: 0, higherIsBetter: false })).toBe("loss");
    expect(compareTotals({ mine: 0, theirs: null, higherIsBetter: false })).toBe("win");
  });
});

describe("scoreMatchup", () => {
  it("tallies each category from my side", () => {
    const [a, b] = TEAMS;
    if (!a || !b) throw new Error("fixture");

    const score = scoreMatchup({ categories: [STEALS, TURNOVERS], mine: a, theirs: b });

    expect(score.rows.map(({ result }) => result)).toEqual(["loss", "loss"]);
    expect(score).toMatchObject({ wins: 0, losses: 2, ties: 0 });
    expect(score.rows[0]).toMatchObject({ mine: "20", theirs: "35" });
  });

  it("shows a dash for a category the host sent no total for", () => {
    const [a] = TEAMS;
    if (!a) throw new Error("fixture");

    const score = scoreMatchup({
      categories: [{ statId: 99, label: "X", higherIsBetter: true }],
      mine: a,
      theirs: a,
    });

    expect(score.rows[0]).toMatchObject({ mine: "-", theirs: "-", result: "tie" });
    expect(score.ties).toBe(1);
  });
});

describe("rankCategory", () => {
  it("ranks best first, sharing a place between level teams and skipping the next", () => {
    const ranks = rankCategory({ category: STEALS, teams: TEAMS });

    expect(Object.fromEntries(ranks)).toEqual({ a: 3, b: 1, c: 1, d: 4 });
  });

  it("ranks the fewest turnovers first", () => {
    const ranks = rankCategory({ category: TURNOVERS, teams: TEAMS });

    expect(Object.fromEntries(ranks)).toEqual({ a: 2, b: 1, c: 4, d: 3 });
  });
});

describe("buildStandings", () => {
  it("marks a first and a last place, and nothing in between", () => {
    const standings =
      buildStandings({ categories: [STEALS, TURNOVERS], teams: TEAMS }).get("d") ?? [];

    expect(standings[0]).toMatchObject({ rank: 4, of: 4, isBest: false, isWorst: true });
    expect(standings[1]).toMatchObject({ rank: 3, isBest: false, isWorst: false });
  });

  it("calls a shared first place best", () => {
    const [steals] = buildStandings({ categories: [STEALS], teams: TEAMS }).get("c") ?? [];

    expect(steals).toMatchObject({ rank: 1, isBest: true, isWorst: false });
  });

  it("calls nobody best or worst when every team is level", () => {
    const level = [
      team({ teamId: "x", steals: "5", turnovers: "5" }),
      team({ teamId: "y", steals: "5", turnovers: "5" }),
    ];

    const [steals] = buildStandings({ categories: [STEALS], teams: level }).get("x") ?? [];

    expect(steals).toMatchObject({ rank: 1, isBest: false, isWorst: false });
  });

  it("skips a team that is not in the week", () => {
    expect(buildStandings({ categories: [STEALS], teams: TEAMS }).has("zzz")).toBe(false);
  });
});

describe("averageRank", () => {
  it("averages a team's places across the categories", () => {
    const standings = buildStandings({ categories: [STEALS, TURNOVERS], teams: TEAMS });
    expect(averageRank({ standings: standings.get("a") ?? [] })).toBe(2.5);
  });

  it("is null with no categories", () => {
    expect(averageRank({ standings: [] })).toBeNull();
  });
});
