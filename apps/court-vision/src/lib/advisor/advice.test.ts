import { describe, expect, it } from "bun:test";

import { type FantasyPlayerValues } from "@vision/core/valuation/types";

import { buildAdvice } from "@/lib/advisor/advice";
import { fakeBreakdownFor } from "@/lib/advisor/fixture";
import { type AdvisorLeagueData, type AdvisorTeam } from "@/lib/advisor/types";
import { makeStatLine } from "@/lib/valuation/fixtures";

type ValuedProps = { playerId: number; z: number };

const valued = ({ playerId, z }: ValuedProps): FantasyPlayerValues => ({
  playerId,
  z,
  g: 0,
  points: 0,
  vorp: 0,
  positional: 0,
  sgp: 0,
  sim: 0,
});

type TeamProps = { teamId: string; ids: number[]; isMine?: boolean };

const team = ({ teamId, ids, isMine = false }: TeamProps): AdvisorTeam => ({
  teamId,
  name: `Team ${teamId}`,
  managerName: isMine ? null : "Sam",
  isMine,
  players: ids.map((playerId) => ({ playerId, slotType: "BENCH", injuryStatus: null })),
});

// Mine (1, 2, 3) is weak on rebounds; team b has the league's best rebounder
// (10); 20 and 21 are free agents, 21 a rebounder.
const SCORES = new Map([
  [1, { pts: 3, reb: -1 }],
  [2, { pts: 2, reb: -1 }],
  [3, { pts: 0, reb: 0 }],
  [10, { pts: 1, reb: 4 }],
  [11, { pts: 0, reb: 0 }],
  [20, { pts: 0, reb: 1 }],
  [21, { pts: -1, reb: 3 }],
]);
const IDS = [...SCORES.keys()];

const LEAGUE: AdvisorLeagueData = {
  myRoster: [1, 2, 3].map((playerId) => ({
    playerId,
    fullName: `Player ${playerId}`,
    slotType: "BENCH",
    injuryStatus: null,
  })),
  rosteredPlayerIds: [1, 2, 3, 10, 11],
  waivers: [{ playerId: 21, injuryStatus: null }],
  unmatched: [],
  teams: [
    team({ teamId: "a", ids: [1, 2, 3], isMine: true }),
    team({ teamId: "b", ids: [10, 11] }),
  ],
};

const advise = () =>
  buildAdvice({
    lines: IDS.map((playerId) => makeStatLine({ playerId })),
    values: IDS.map((playerId) => {
      const { pts, reb } = SCORES.get(playerId) ?? { pts: 0, reb: 0 };
      return valued({ playerId, z: pts + reb });
    }),
    valueKey: "z",
    league: LEAGUE,
    activePlayerIds: new Set(IDS),
    breakdownFor: fakeBreakdownFor({ scores: SCORES }),
    scoreKey: "z",
  });

describe("buildAdvice", () => {
  it("names the weakest category and the player who fixes it", () => {
    const advice = advise();
    expect(advice?.weakness).toMatchObject({ key: "reb", rank: 2, of: 2 });
    expect(advice?.target).toMatchObject({
      playerId: 10,
      categoryScore: 4,
      owner: { kind: "team", teamId: "b", teamName: "Team b" },
    });
  });

  it("offers three trades for a player on another team", () => {
    const trades = advise()?.trades ?? [];
    expect(trades.map(({ tier }) => tier)).toEqual(["favors_me", "fair", "favors_them"]);
    const offers = trades.flatMap((group) => group.offers);
    // Three players make six packages, all of them offered once.
    expect(offers).toHaveLength(6);
    expect(offers.every(({ get }) => get.playerId === 10)).toBe(true);
  });

  it("lists free agents for the category and who to drop", () => {
    const advice = advise();
    expect(advice?.drop?.playerId).toBe(3);
    expect(advice?.freeAgents.map(({ playerId, owner }) => [playerId, owner.kind])).toEqual([
      [21, "waivers"],
      [20, "free_agent"],
    ]);
  });

  it("offers no trades when the best fit is a free agent", () => {
    const advice = buildAdvice({
      lines: IDS.map((playerId) => makeStatLine({ playerId })),
      values: IDS.map((playerId) => valued({ playerId, z: playerId === 21 ? 9 : 1 })),
      valueKey: "z",
      league: {
        ...LEAGUE,
        teams: [
          team({ teamId: "a", ids: [1, 2, 3], isMine: true }),
          team({ teamId: "b", ids: [11] }),
        ],
      },
      activePlayerIds: new Set(IDS),
      breakdownFor: fakeBreakdownFor({ scores: SCORES }),
      scoreKey: "z",
    });
    expect(advice?.target?.playerId).toBe(21);
    expect(advice?.trades).toEqual([]);
  });

  it("has no advice without my team", () => {
    const advice = buildAdvice({
      lines: [],
      values: [],
      valueKey: "z",
      league: { ...LEAGUE, teams: [] },
      activePlayerIds: new Set(),
      breakdownFor: fakeBreakdownFor({ scores: SCORES }),
      scoreKey: "z",
    });
    expect(advice).toBeNull();
  });
});
