import { describe, expect, it } from "bun:test";

import { type Category, type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";

import { buildSwapBoard } from "@/lib/waiverWire/swapBoard";
import { type WaiverModel, type WaiverRow } from "@/lib/waiverWire/types";

const row = ({
  playerId,
  value,
  owner = "free_agent",
}: {
  playerId: number;
  value: number;
  owner?: WaiverRow["owner"];
}): WaiverRow => ({
  playerId,
  fullName: `Test Player ${playerId}`,
  teamAbbr: "BOS",
  position: "G",
  nbaPersonId: null,
  value,
  rank: playerId,
  owner,
  injuryStatus: null,
});

const model = ({
  weakest,
  freePool,
}: {
  weakest: WaiverRow[];
  freePool: WaiverRow[];
}): WaiverModel => ({ roster: weakest, noStats: [], weakest, freePool });

const LABELS: Partial<Record<Category, string>> = {
  reb: "REB",
  fg: "FG%",
  pts: "PTS",
  ast: "AST",
};

const entry = ({
  key,
  z,
  g = z,
}: {
  key: Category;
  z: number;
  g?: number;
}): FantasyCategoryBreakdown => ({
  key,
  label: LABELS[key] ?? key,
  fullName: key,
  kind: "counting",
  perGame: 0,
  z,
  g,
});

const none = (): FantasyCategoryBreakdown[] => [];

const texts = (chips: { text: string }[]): string[] => chips.map((chip) => chip.text);

describe("buildSwapBoard", () => {
  it("lists only free agents who beat your weakest player, by gain", () => {
    const board = buildSwapBoard({
      model: model({
        weakest: [row({ playerId: 1, value: 2, owner: "mine" })],
        freePool: [
          row({ playerId: 10, value: 5 }),
          row({ playerId: 11, value: 3 }),
          row({ playerId: 12, value: 1 }),
        ],
      }),
      breakdownFor: none,
      scoreKey: "z",
    });
    expect(board.target?.playerId).toBe(1);
    expect(board.rows.map((r) => r.playerId)).toEqual([10, 11]);
    expect(board.rows.map((r) => r.gain)).toEqual([3, 1]);
  });

  it("orders equal gains by player id", () => {
    const board = buildSwapBoard({
      model: model({
        weakest: [row({ playerId: 1, value: 0, owner: "mine" })],
        freePool: [row({ playerId: 30, value: 2 }), row({ playerId: 20, value: 2 })],
      }),
      breakdownFor: none,
      scoreKey: "z",
    });
    expect(board.rows.map((r) => r.playerId)).toEqual([20, 30]);
  });

  it("does not count an equal value as an upgrade", () => {
    const board = buildSwapBoard({
      model: model({
        weakest: [row({ playerId: 1, value: 2, owner: "mine" })],
        freePool: [row({ playerId: 10, value: 2 })],
      }),
      breakdownFor: none,
      scoreKey: "z",
    });
    expect(board.rows).toEqual([]);
  });

  it("chips the three biggest category differences", () => {
    const board = buildSwapBoard({
      model: model({
        weakest: [row({ playerId: 1, value: 0, owner: "mine" })],
        freePool: [row({ playerId: 10, value: 1 })],
      }),
      breakdownFor: ({ playerId }) =>
        playerId === 1
          ? [
              entry({ key: "reb", z: 0 }),
              entry({ key: "fg", z: 0 }),
              entry({ key: "pts", z: 0 }),
              entry({ key: "ast", z: 0 }),
            ]
          : [
              entry({ key: "reb", z: 1.2 }),
              entry({ key: "fg", z: -0.9 }),
              entry({ key: "pts", z: 0.5 }),
              entry({ key: "ast", z: 0.1 }),
            ],
      scoreKey: "z",
    });
    const [first] = board.rows;
    expect(texts(first?.chips ?? [])).toEqual(["+REB", "−FG%", "+PTS"]);
    expect(first?.chips.map((chip) => chip.improves)).toEqual([true, false, true]);
    expect(first?.chips.map((chip) => chip.key)).toEqual(["reb", "fg", "pts"]);
  });

  it("scores chips by g for the G-Score method", () => {
    const board = buildSwapBoard({
      model: model({
        weakest: [row({ playerId: 1, value: 0, owner: "mine" })],
        freePool: [row({ playerId: 10, value: 1 })],
      }),
      breakdownFor: ({ playerId }) =>
        playerId === 1
          ? [entry({ key: "reb", z: 0, g: 0 }), entry({ key: "ast", z: 0, g: 0 })]
          : [entry({ key: "reb", z: 2, g: -1 }), entry({ key: "ast", z: 0, g: 0.4 })],
      scoreKey: "g",
    });
    expect(texts(board.rows[0]?.chips ?? [])).toEqual(["−REB", "+AST"]);
  });

  it("never chips a category with no difference and gives no chips without a breakdown", () => {
    const board = buildSwapBoard({
      model: model({
        weakest: [row({ playerId: 1, value: 0, owner: "mine" })],
        freePool: [row({ playerId: 10, value: 1 }), row({ playerId: 11, value: 2 })],
      }),
      breakdownFor: ({ playerId }) => {
        if (playerId === 1) return [entry({ key: "reb", z: 0 }), entry({ key: "ast", z: 0 })];
        if (playerId === 10) return [entry({ key: "reb", z: 0 }), entry({ key: "ast", z: 0.3 })];
        return [];
      },
      scoreKey: "z",
    });
    const byId = (id: number) => board.rows.find((r) => r.playerId === id);
    expect(texts(byId(10)?.chips ?? [])).toEqual(["+AST"]);
    expect(byId(11)?.chips).toEqual([]);
  });

  it("has no target and no rows without a weakest player", () => {
    const board = buildSwapBoard({
      model: model({ weakest: [], freePool: [row({ playerId: 10, value: 9 })] }),
      breakdownFor: none,
      scoreKey: "z",
    });
    expect(board).toEqual({ target: null, rows: [] });
  });
});
