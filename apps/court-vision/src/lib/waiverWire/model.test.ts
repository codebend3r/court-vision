import { describe, expect, it } from "bun:test";

import { type FantasyPlayerValues } from "@vision/core/valuation/types";

import { makeStatLine } from "@/lib/valuation/fixtures";
import { buildWaiverModel } from "@/lib/waiverWire/model";
import { type WaiverLeagueData, type WaiverRosterEntry } from "@/lib/waiverWire/types";

const valued = ({
  playerId,
  z,
  g = 0,
}: {
  playerId: number;
  z: number;
  g?: number;
}): FantasyPlayerValues => ({
  playerId,
  z,
  g,
  points: 0,
  vorp: 0,
  positional: 0,
  sgp: 0,
  sim: 0,
});

const mine = ({
  playerId,
  slotType = "BENCH",
  injuryStatus = null,
}: Partial<WaiverRosterEntry> & { playerId: number }): WaiverRosterEntry => ({
  playerId,
  fullName: `Test Player ${playerId}`,
  slotType,
  injuryStatus,
});

const league = (overrides: Partial<WaiverLeagueData>): WaiverLeagueData => ({
  myRoster: [],
  rosteredPlayerIds: [],
  waivers: [],
  ...overrides,
});

const ids = (rows: readonly { playerId: number }[]): number[] => rows.map((row) => row.playerId);

describe("buildWaiverModel", () => {
  it("splits the valued pool into my roster and the free pool", () => {
    const model = buildWaiverModel({
      lines: [1, 2, 3, 4, 5].map((playerId) => makeStatLine({ playerId })),
      values: [
        valued({ playerId: 1, z: 5 }),
        valued({ playerId: 2, z: 4 }),
        valued({ playerId: 3, z: 3 }),
        valued({ playerId: 4, z: 2 }),
        valued({ playerId: 5, z: 1 }),
      ],
      valueKey: "z",
      league: league({
        myRoster: [mine({ playerId: 1 }), mine({ playerId: 4 })],
        rosteredPlayerIds: [1, 2, 4],
      }),
      activePlayerIds: new Set([1, 2, 3, 4]),
      pos: "all",
    });

    expect(ids(model.roster)).toEqual([1, 4]);
    expect(model.roster.every((row) => row.owner === "mine")).toBe(true);
    expect(ids(model.freePool)).toEqual([3]);
    expect(model.freePool[0]?.owner ?? null).toBe("free_agent");
    expect(model.freePool[0]?.value ?? null).toBe(3);
  });

  it("leaves IL players out of my roster", () => {
    const model = buildWaiverModel({
      lines: [1, 2, 3].map((playerId) => makeStatLine({ playerId })),
      values: [
        valued({ playerId: 1, z: 5 }),
        valued({ playerId: 2, z: -3 }),
        valued({ playerId: 3, z: -4 }),
      ],
      valueKey: "z",
      league: league({
        myRoster: [
          mine({ playerId: 1 }),
          mine({ playerId: 2, slotType: "IL" }),
          mine({ playerId: 3, slotType: "ILPLUS" }),
        ],
        rosteredPlayerIds: [1, 2, 3],
      }),
      activePlayerIds: new Set([1, 2, 3]),
      pos: "all",
    });

    expect(ids(model.roster)).toEqual([1]);
    expect(ids(model.weakest)).toEqual([1]);
    expect(model.noStats).toEqual([]);
  });

  it("lists my players with no line under noStats, never as weakest", () => {
    const noLine = mine({ playerId: 2 });
    const unvalued = mine({ playerId: 3 });
    const model = buildWaiverModel({
      lines: [1, 3].map((playerId) => makeStatLine({ playerId })),
      values: [valued({ playerId: 1, z: 5 })],
      valueKey: "z",
      league: league({
        myRoster: [mine({ playerId: 1 }), noLine, unvalued, mine({ playerId: 4, slotType: "IL" })],
        rosteredPlayerIds: [1, 2, 3, 4],
      }),
      activePlayerIds: new Set([1, 2, 3, 4]),
      pos: "all",
    });

    expect(model.noStats).toEqual([noLine, unvalued]);
    expect(ids(model.roster)).toEqual([1]);
    expect(ids(model.weakest)).toEqual([1]);
  });

  it("picks the three lowest-valued players, lowest first", () => {
    const model = buildWaiverModel({
      lines: [1, 2, 3, 4, 5].map((playerId) => makeStatLine({ playerId })),
      values: [
        valued({ playerId: 1, z: 2 }),
        valued({ playerId: 2, z: -1 }),
        valued({ playerId: 3, z: 6 }),
        valued({ playerId: 4, z: 0.5 }),
        valued({ playerId: 5, z: -2 }),
      ],
      valueKey: "z",
      league: league({
        myRoster: [1, 2, 3, 4, 5].map((playerId) => mine({ playerId })),
        rosteredPlayerIds: [1, 2, 3, 4, 5],
      }),
      activePlayerIds: new Set([1, 2, 3, 4, 5]),
      pos: "all",
    });

    expect(ids(model.roster)).toEqual([3, 1, 4, 2, 5]);
    expect(ids(model.weakest)).toEqual([5, 2, 4]);
  });

  it("copes with fewer than three valued players", () => {
    const one = buildWaiverModel({
      lines: [makeStatLine({ playerId: 1 })],
      values: [valued({ playerId: 1, z: 1 })],
      valueKey: "z",
      league: league({ myRoster: [mine({ playerId: 1 })], rosteredPlayerIds: [1] }),
      activePlayerIds: new Set([1]),
      pos: "all",
    });

    expect(ids(one.weakest)).toEqual([1]);

    const none = buildWaiverModel({
      lines: [],
      values: [],
      valueKey: "z",
      league: league({
        myRoster: [mine({ playerId: 1 }), mine({ playerId: 2 })],
        rosteredPlayerIds: [1, 2],
      }),
      activePlayerIds: new Set([1, 2]),
      pos: "all",
    });

    expect(none.weakest).toEqual([]);
    expect(none.roster).toEqual([]);
    expect(ids(none.noStats)).toEqual([1, 2]);
  });

  it("tags waiver players and carries injury status", () => {
    const model = buildWaiverModel({
      lines: [1, 2, 3].map((playerId) => makeStatLine({ playerId })),
      values: [
        valued({ playerId: 1, z: 3 }),
        valued({ playerId: 2, z: 2 }),
        valued({ playerId: 3, z: 1 }),
      ],
      valueKey: "z",
      league: league({
        myRoster: [mine({ playerId: 1, injuryStatus: "Q" })],
        rosteredPlayerIds: [1],
        waivers: [{ playerId: 2, injuryStatus: "O" }],
      }),
      activePlayerIds: new Set([1, 2, 3]),
      pos: "all",
    });

    expect(model.roster[0]?.injuryStatus ?? null).toBe("Q");
    expect(
      model.freePool.map(({ playerId, owner, injuryStatus }) => ({
        playerId,
        owner,
        injuryStatus,
      })),
    ).toEqual([
      { playerId: 2, owner: "waivers", injuryStatus: "O" },
      { playerId: 3, owner: "free_agent", injuryStatus: null },
    ]);
  });

  it("ranks against the whole valued pool", () => {
    const model = buildWaiverModel({
      lines: [1, 2, 3, 4].map((playerId) => makeStatLine({ playerId })),
      values: [
        valued({ playerId: 1, z: 1 }),
        valued({ playerId: 2, z: 9 }),
        valued({ playerId: 3, z: 8 }),
        valued({ playerId: 4, z: 0 }),
      ],
      valueKey: "z",
      league: league({ myRoster: [mine({ playerId: 1 })], rosteredPlayerIds: [1, 2, 3] }),
      activePlayerIds: new Set([1, 2, 3, 4]),
      pos: "all",
    });

    expect(model.roster[0]?.rank ?? null).toBe(3);
    expect(model.freePool[0]?.rank ?? null).toBe(4);
  });

  it("filters free agents by position group", () => {
    const model = buildWaiverModel({
      lines: [
        makeStatLine({ playerId: 1, position: "G" }),
        makeStatLine({ playerId: 2, position: "F-C" }),
        makeStatLine({ playerId: 3, position: "C" }),
        makeStatLine({ playerId: 4, position: "G" }),
      ],
      values: [
        valued({ playerId: 1, z: 4 }),
        valued({ playerId: 2, z: 3 }),
        valued({ playerId: 3, z: 2 }),
        valued({ playerId: 4, z: 1 }),
      ],
      valueKey: "z",
      league: league({ myRoster: [mine({ playerId: 1 })], rosteredPlayerIds: [1] }),
      activePlayerIds: new Set([1, 2, 3, 4]),
      pos: "C",
    });

    expect(ids(model.freePool)).toEqual([2, 3]);
    expect(ids(model.roster)).toEqual([1]);
  });

  it("ranks by the chosen method", () => {
    const model = buildWaiverModel({
      lines: [1, 2, 3].map((playerId) => makeStatLine({ playerId })),
      values: [
        valued({ playerId: 1, z: 3, g: 1 }),
        valued({ playerId: 2, z: 2, g: 3 }),
        valued({ playerId: 3, z: 1, g: 2 }),
      ],
      valueKey: "g",
      league: league({}),
      activePlayerIds: new Set([1, 2, 3]),
      pos: "all",
    });

    expect(ids(model.freePool)).toEqual([2, 3, 1]);
    expect(model.freePool.map((row) => row.value)).toEqual([3, 2, 1]);
    expect(model.freePool.map((row) => row.rank)).toEqual([1, 2, 3]);
  });
  it("breaks value ties by playerId", () => {
    const model = buildWaiverModel({
      lines: [3, 1, 2].map((playerId) => makeStatLine({ playerId })),
      values: [
        valued({ playerId: 3, z: 1 }),
        valued({ playerId: 1, z: 1 }),
        valued({ playerId: 2, z: 1 }),
      ],
      valueKey: "z",
      league: league({}),
      activePlayerIds: new Set([1, 2, 3]),
      pos: "all",
    });

    expect(ids(model.freePool)).toEqual([1, 2, 3]);
    expect(model.freePool.map((row) => row.rank)).toEqual([1, 2, 3]);
  });
  it("keeps my IL players out of the free pool even when the league list omits them", () => {
    const model = buildWaiverModel({
      lines: [1, 2].map((playerId) => makeStatLine({ playerId })),
      values: [valued({ playerId: 1, z: 2 }), valued({ playerId: 2, z: 1 })],
      valueKey: "z",
      league: league({
        myRoster: [mine({ playerId: 1 }), mine({ playerId: 2, slotType: "IL" })],
        rosteredPlayerIds: [1],
      }),
      activePlayerIds: new Set([1, 2]),
      pos: "all",
    });

    expect(ids(model.roster)).toEqual([1]);
    expect(model.freePool).toEqual([]);
  });

  it("keeps an inactive player of mine on my roster and out of the free pool", () => {
    const model = buildWaiverModel({
      lines: [1, 2].map((playerId) => makeStatLine({ playerId })),
      values: [valued({ playerId: 1, z: 2 }), valued({ playerId: 2, z: 1 })],
      valueKey: "z",
      league: league({ myRoster: [mine({ playerId: 1 })], rosteredPlayerIds: [] }),
      activePlayerIds: new Set([2]),
      pos: "all",
    });

    expect(ids(model.roster)).toEqual([1]);
    expect(ids(model.freePool)).toEqual([2]);
  });

  it("keeps a valued player with no line out of the free pool", () => {
    const model = buildWaiverModel({
      lines: [makeStatLine({ playerId: 1 })],
      values: [valued({ playerId: 1, z: 1 }), valued({ playerId: 2, z: 5 })],
      valueKey: "z",
      league: league({}),
      activePlayerIds: new Set([1, 2]),
      pos: "all",
    });

    expect(ids(model.freePool)).toEqual([1]);
  });

  it("lists a duplicated unvalued roster entry under noStats once", () => {
    const model = buildWaiverModel({
      lines: [],
      values: [],
      valueKey: "z",
      league: league({
        myRoster: [mine({ playerId: 1 }), mine({ playerId: 1 })],
        rosteredPlayerIds: [1],
      }),
      activePlayerIds: new Set([1]),
      pos: "all",
    });

    expect(ids(model.noStats)).toEqual([1]);
  });
});
