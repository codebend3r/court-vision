import { describe, expect, it } from "bun:test";

import { buildCutLine, type CutLineEntry } from "@/lib/waiverWire/cutLine";
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

const mine = ({ playerId, value }: { playerId: number; value: number }): WaiverRow =>
  row({ playerId, value, owner: "mine" });

const model = ({
  roster,
  freePool,
}: {
  roster: WaiverRow[];
  freePool: WaiverRow[];
}): WaiverModel => ({ roster, noStats: [], weakest: [], freePool });

// A compact label for each entry: the player id, or `-` for the line.
const ids = (entries: CutLineEntry[]): (number | "-")[] =>
  entries.map((entry) => (entry.kind === "line" ? "-" : entry.row.playerId));

describe("buildCutLine", () => {
  it("merges your roster and the free pool by value with the line under your worst", () => {
    const { entries, hiddenAbove, hiddenBelow } = buildCutLine({
      model: model({
        roster: [mine({ playerId: 1, value: 5 }), mine({ playerId: 2, value: 1 })],
        freePool: [row({ playerId: 3, value: 3 }), row({ playerId: 4, value: 0 })],
      }),
      scope: "all",
      showAll: true,
    });

    expect(ids(entries)).toEqual([1, 3, 2, "-", 4]);
    expect(hiddenAbove).toBe(0);
    expect(hiddenBelow).toBe(0);
  });

  it("breaks value ties by player id ascending", () => {
    const { entries } = buildCutLine({
      model: model({
        roster: [mine({ playerId: 9, value: 2 })],
        freePool: [row({ playerId: 12, value: 2 }), row({ playerId: 4, value: 2 })],
      }),
      scope: "all",
      showAll: true,
    });

    expect(ids(entries)).toEqual([4, 9, "-", 12]);
  });

  it("marks free agents above the line as upgrades", () => {
    const { entries } = buildCutLine({
      model: model({
        roster: [mine({ playerId: 1, value: 5 }), mine({ playerId: 2, value: 1 })],
        freePool: [
          row({ playerId: 3, value: 3 }),
          row({ playerId: 5, value: 1 }),
          row({ playerId: 4, value: 0, owner: "waivers" }),
          row({ playerId: 6, value: 7, owner: "waivers" }),
        ],
      }),
      scope: "all",
      showAll: true,
    });

    const upgrades = entries.flatMap((entry) =>
      entry.kind === "row" && entry.isUpgrade ? [entry.row.playerId] : [],
    );
    expect(upgrades).toEqual([6, 3]);
    expect(ids(entries)).toEqual([6, 1, 3, 2, "-", 5, 4]);
  });

  it("does not treat a tie with your worst as an upgrade", () => {
    const { entries } = buildCutLine({
      model: model({
        roster: [mine({ playerId: 5, value: 1 })],
        freePool: [row({ playerId: 2, value: 1 })],
      }),
      scope: "all",
      showAll: true,
    });

    expect(ids(entries)).toEqual([2, 5, "-"]);
    expect(entries[0]).toEqual({
      kind: "row",
      row: row({ playerId: 2, value: 1 }),
      isUpgrade: false,
    });
  });

  it("shows free agents only, keeping the line in place", () => {
    const { entries } = buildCutLine({
      model: model({
        roster: [mine({ playerId: 1, value: 5 }), mine({ playerId: 2, value: 1 })],
        freePool: [
          row({ playerId: 3, value: 3 }),
          row({ playerId: 4, value: 2 }),
          row({ playerId: 5, value: 0 }),
        ],
      }),
      scope: "fa",
      showAll: true,
    });

    expect(ids(entries)).toEqual([3, 4, "-", 5]);
  });

  it("windows the list around the line", () => {
    const freePool = Array.from({ length: 6 }, (_, index) =>
      row({ playerId: 100 + index, value: 20 - index }),
    ).concat(
      Array.from({ length: 10 }, (_, index) => row({ playerId: 200 + index, value: -index })),
    );
    const roster = [mine({ playerId: 1, value: 50 }), mine({ playerId: 2, value: 10 })];
    // Merged: 1, 100..105 (upgrades, values 20..15), 2, line, 200..209.
    const input = model({ roster, freePool });

    const windowed = buildCutLine({ model: input, scope: "all", showAll: false });
    // The best upgrade (100) sits at index 1, so the window starts at index 0 (clamped),
    // and ends 5 rows after the line.
    expect(ids(windowed.entries)).toEqual([
      1,
      100,
      101,
      102,
      103,
      104,
      105,
      2,
      "-",
      200,
      201,
      202,
      203,
      204,
    ]);
    expect(windowed.hiddenAbove).toBe(0);
    expect(windowed.hiddenBelow).toBe(5);

    const deep = buildCutLine({
      model: model({
        roster: [mine({ playerId: 1, value: 50 }), mine({ playerId: 2, value: 10 })],
        freePool: [
          ...Array.from({ length: 5 }, (_, index) =>
            row({ playerId: 10 + index, value: 40 - index }),
          ),
          row({ playerId: 100, value: 20 }),
          row({ playerId: 200, value: 1 }),
          row({ playerId: 201, value: 0 }),
        ],
      }),
      scope: "fa",
      showAll: false,
    });
    // fa entries: 10..14, 100, line, 200, 201. Best upgrade is index 0 -> no rows hidden above.
    expect(ids(deep.entries)).toEqual([10, 11, 12, 13, 14, 100, "-", 200, 201]);
    expect(deep.hiddenAbove).toBe(0);
    expect(deep.hiddenBelow).toBe(0);

    const everything = buildCutLine({ model: input, scope: "all", showAll: true });
    expect(everything.entries).toHaveLength(freePool.length + roster.length + 1);
    expect(everything.hiddenAbove).toBe(0);
    expect(everything.hiddenBelow).toBe(0);
  });

  it("hides rows above the window when the best upgrade is deep in the list", () => {
    const top = Array.from({ length: 6 }, (_, index) =>
      mine({ playerId: 1 + index, value: 100 - index }),
    );
    const { entries, hiddenAbove, hiddenBelow } = buildCutLine({
      model: model({
        roster: [...top, mine({ playerId: 50, value: 10 })],
        freePool: [
          row({ playerId: 60, value: 20 }),
          ...Array.from({ length: 8 }, (_, index) =>
            row({ playerId: 70 + index, value: 5 - index }),
          ),
        ],
      }),
      scope: "all",
      showAll: false,
    });

    // Merged: 1..6, 60 (first upgrade, index 6), 50, line (index 8), 70..77.
    // Window starts at index 3 (4), ends 5 rows after the line (index 14 exclusive).
    expect(ids(entries)).toEqual([4, 5, 6, 60, 50, "-", 70, 71, 72, 73, 74]);
    expect(hiddenAbove).toBe(3);
    expect(hiddenBelow).toBe(3);
  });

  it("starts at the line when there are no upgrades", () => {
    const { entries, hiddenAbove, hiddenBelow } = buildCutLine({
      model: model({
        roster: [
          ...Array.from({ length: 5 }, (_, index) =>
            mine({ playerId: 1 + index, value: 100 - index }),
          ),
        ],
        freePool: Array.from({ length: 7 }, (_, index) =>
          row({ playerId: 20 + index, value: 10 - index }),
        ),
      }),
      scope: "all",
      showAll: false,
    });

    expect(ids(entries)).toEqual(["-", 20, 21, 22, 23, 24]);
    expect(hiddenAbove).toBe(5);
    expect(hiddenBelow).toBe(2);
  });

  it("has no line without a valued roster", () => {
    const freePool = Array.from({ length: 10 }, (_, index) =>
      row({ playerId: 1 + index, value: 10 - index }),
    );

    const windowed = buildCutLine({
      model: model({ roster: [], freePool }),
      scope: "all",
      showAll: false,
    });
    expect(ids(windowed.entries)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(windowed.hiddenAbove).toBe(0);
    expect(windowed.hiddenBelow).toBe(2);
    expect(windowed.entries.every((entry) => entry.kind === "row" && !entry.isUpgrade)).toBe(true);

    const everything = buildCutLine({
      model: model({ roster: [], freePool }),
      scope: "fa",
      showAll: true,
    });
    expect(everything.entries).toHaveLength(10);
    expect(everything.hiddenBelow).toBe(0);
  });
});
