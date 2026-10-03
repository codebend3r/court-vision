import { describe, expect, it } from "bun:test";

import {
  buildLeaderLine,
  buildUnrankedLine,
  type LeaderDef,
  percentage,
  perGame,
} from "#core/series/leaders";

type Row = { playerId: number; games: number; goals: number; saves: number; shots: number };

const DEFS: readonly LeaderDef<Row>[] = [
  {
    key: "goals",
    label: "G",
    rankTone: "leader",
    valueOf: (row) => perGame({ total: row.goals, gamesPlayed: row.games }),
    qualifies: (row) => row.games >= 10,
    format: (value) => value.toFixed(2),
  },
  {
    key: "svPct",
    label: "SV%",
    rankTone: "neutral",
    valueOf: (row) => percentage({ made: row.saves, attempted: row.shots }),
    qualifies: (row) => row.shots >= 100,
    format: (value) => `${value.toFixed(1)}%`,
  },
];

const ROWS: Row[] = [
  { playerId: 1, games: 20, goals: 10, saves: 0, shots: 0 },
  { playerId: 2, games: 20, goals: 20, saves: 900, shots: 1000 },
  { playerId: 3, games: 5, goals: 50, saves: 95, shots: 100 },
  { playerId: 4, games: 20, goals: 10, saves: 0, shots: 0 },
];

describe("perGame and percentage", () => {
  it("are null with nothing to divide by", () => {
    expect(perGame({ total: 5, gamesPlayed: 0 })).toBeNull();
    expect(percentage({ made: 5, attempted: 0 })).toBeNull();
    expect(percentage({ made: 9, attempted: 10 })).toBe(90);
  });
});

describe("buildLeaderLine", () => {
  it("ranks against qualified players only, ties sharing a rank", () => {
    const line = buildLeaderLine({ defs: DEFS, rows: ROWS, playerId: 1 });
    // Player 3's 10 goals/game do not qualify (5 games); 2 is ahead; 4 ties.
    expect(line?.[0]).toEqual({
      key: "goals",
      label: "G",
      value: "0.50",
      rank: 2,
      rankTone: "leader",
      eligibleCount: 3,
    });
  });

  it("still ranks a viewed player below the floor without counting them as eligible", () => {
    const line = buildLeaderLine({ defs: DEFS, rows: ROWS, playerId: 3 });
    expect(line?.[0]?.rank).toBe(1);
    expect(line?.[0]?.eligibleCount).toBe(3);
  });

  it("drops a stat the player has no value for", () => {
    const line = buildLeaderLine({ defs: DEFS, rows: ROWS, playerId: 1 });
    expect(line?.map((stat) => stat.key)).toEqual(["goals"]);
  });

  it("ranks everyone with a value when minimums are off", () => {
    const line = buildLeaderLine({ defs: DEFS, rows: ROWS, playerId: 1, applyMinimums: false });
    expect(line?.[0]?.rank).toBe(3);
    expect(line?.[0]?.eligibleCount).toBe(4);
  });

  it("is null for a player with no row", () => {
    expect(buildLeaderLine({ defs: DEFS, rows: ROWS, playerId: 99 })).toBeNull();
  });
});

describe("buildUnrankedLine", () => {
  it("formats values with no rank", () => {
    const row = ROWS[1];
    expect(row === undefined ? [] : buildUnrankedLine({ defs: DEFS, row })).toEqual([
      { key: "goals", label: "G", value: "1.00", rank: null, rankTone: "leader", eligibleCount: 0 },
      {
        key: "svPct",
        label: "SV%",
        value: "90.0%",
        rank: null,
        rankTone: "neutral",
        eligibleCount: 0,
      },
    ]);
  });
});
