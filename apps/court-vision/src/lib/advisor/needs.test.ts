import { describe, expect, it } from "bun:test";

import { fakeBreakdownFor } from "@/lib/advisor/fixture";
import { buildNeeds, healthyIds, MAX_WEAK_NEEDS, pickWeakNeeds } from "@/lib/advisor/needs";
import { type CategoryNeed } from "@/lib/advisor/types";
import { type AdvisorTeam } from "@/lib/advisor/types";

type TeamProps = { teamId: string; ids: number[]; isMine?: boolean; il?: number[] };

const team = ({ teamId, ids, isMine = false, il = [] }: TeamProps): AdvisorTeam => ({
  teamId,
  name: `Team ${teamId}`,
  managerName: null,
  isMine,
  players: [
    ...ids.map((playerId) => ({ playerId, slotType: "UTIL" as const, injuryStatus: null })),
    ...il.map((playerId) => ({ playerId, slotType: "IL" as const, injuryStatus: "O" })),
  ],
});

const breakdownFor = fakeBreakdownFor({
  scores: new Map([
    [1, { pts: 2, reb: -1, ast: 0 }],
    [2, { pts: 1, reb: -1, ast: 1 }],
    [3, { pts: 0, reb: 2, ast: 0 }],
    [4, { pts: 0, reb: 1, ast: 0 }],
    [5, { pts: -1, reb: 0, ast: 0 }],
    [6, { pts: 0, reb: 0, ast: 0 }],
    // An IL star, who must not count.
    [9, { pts: 0, reb: 9, ast: 0 }],
  ]),
});

describe("healthyIds", () => {
  it("leaves IL players out and lists each player once", () => {
    const withRepeat = team({ teamId: "a", ids: [1, 1, 2], il: [9] });
    expect(healthyIds({ team: withRepeat })).toEqual([1, 2]);
  });
});

describe("buildNeeds", () => {
  const teams = [
    team({ teamId: "a", ids: [1, 2], isMine: true, il: [9] }),
    team({ teamId: "b", ids: [3, 4] }),
    team({ teamId: "c", ids: [5, 6] }),
  ];

  it("ranks every category, weakest first", () => {
    const needs = buildNeeds({ teams, breakdownFor, scoreKey: "z" });
    expect(needs.map(({ key, rank, of }) => [key, rank, of])).toEqual([
      ["reb", 3, 3],
      ["ast", 1, 3],
      ["pts", 1, 3],
    ]);
    expect(needs[0]).toMatchObject({ label: "REB", myTotal: -2, leagueAverage: 1 / 3 });
  });

  it("breaks a rank tie by the gap below the league average", () => {
    // My pts and ast both rank first; ast leads the league by less, so it is weaker.
    const [, second, third] = buildNeeds({ teams, breakdownFor, scoreKey: "z" });
    expect(second?.key).toBe("ast");
    expect(third?.key).toBe("pts");
    const tied = buildNeeds({
      teams: [team({ teamId: "a", ids: [2], isMine: true }), team({ teamId: "b", ids: [6] })],
      breakdownFor,
      scoreKey: "z",
    });
    // pts and ast both 1 over the other team's 0: equal, so table order holds.
    expect(tied.map(({ key }) => key)).toEqual(["reb", "pts", "ast"]);
  });

  it("is empty without a team of mine or any valued player", () => {
    expect(buildNeeds({ teams: teams.slice(1), breakdownFor, scoreKey: "z" })).toEqual([]);
    expect(
      buildNeeds({
        teams: [team({ teamId: "a", ids: [99], isMine: true })],
        breakdownFor,
        scoreKey: "z",
      }),
    ).toEqual([]);
  });
});

describe("pickWeakNeeds", () => {
  type NeedProps = { key: CategoryNeed["key"]; rank: number };

  const need = ({ key, rank }: NeedProps): CategoryNeed => ({
    key,
    label: key.toUpperCase(),
    myTotal: 0,
    leagueAverage: 0,
    rank,
    of: 12,
  });

  it("keeps the bottom half of the league, weakest first, at most three", () => {
    const needs = [
      need({ key: "ast", rank: 12 }),
      need({ key: "pts", rank: 11 }),
      need({ key: "reb", rank: 9 }),
      need({ key: "stl", rank: 7 }),
      need({ key: "blk", rank: 6 }),
    ];
    expect(pickWeakNeeds({ needs }).map(({ key }) => key)).toEqual(["ast", "pts", "reb"]);
    expect(pickWeakNeeds({ needs })).toHaveLength(MAX_WEAK_NEEDS);
  });

  it("always keeps the weakest, even for a team in the top half everywhere", () => {
    const needs = [need({ key: "ast", rank: 5 }), need({ key: "pts", rank: 1 })];
    expect(pickWeakNeeds({ needs }).map(({ key }) => key)).toEqual(["ast"]);
    expect(pickWeakNeeds({ needs: [] })).toEqual([]);
  });
});
