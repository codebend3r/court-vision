import { describe, expect, it } from "bun:test";

import { rankFantasyRows } from "@/lib/valuation/fantasyRows";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type FantasyPlayerValues } from "@vision/core/valuation/types";
import { type FantasyStatLine } from "@/lib/valuation/types";

const line = ({
  playerId,
  firstName = `First${playerId}`,
  lastName = `Last${playerId}`,
}: {
  playerId: number;
  firstName?: string;
  lastName?: string;
}): FantasyStatLine =>
  makeStatLine({ playerId, firstName, lastName, fullName: `${firstName} ${lastName}` });

const scores = ({
  playerId,
  z = 0,
  positional = 0,
}: {
  playerId: number;
  z?: number;
  positional?: number;
}): FantasyPlayerValues => ({ playerId, z, g: 0, points: 0, vorp: 0, positional, sgp: 0, sim: 0 });

const base = { q: "", page: 1, size: 50, dir: "desc", sort: "z" } as const;

const idsOf = (rows: readonly { playerId: number }[]): number[] => rows.map((row) => row.playerId);

describe("rankFantasyRows", () => {
  it("orders by the sorted column's value field and numbers every row", () => {
    const result = rankFantasyRows({
      ...base,
      sort: "pos",
      lines: [1, 2, 3].map((playerId) => line({ playerId })),
      values: [
        scores({ playerId: 1, z: 9, positional: 1 }),
        scores({ playerId: 2, z: 1, positional: 3 }),
        scores({ playerId: 3, z: 5, positional: 2 }),
      ],
    });

    expect(idsOf(result.rows)).toEqual([2, 3, 1]);
    expect(result.rows.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it("breaks value ties by player id whatever the direction", () => {
    const lines = [line({ playerId: 2, lastName: "Abe" }), line({ playerId: 1, lastName: "Zed" })];
    const values = [scores({ playerId: 1, z: 1 }), scores({ playerId: 2, z: 1 })];

    expect(idsOf(rankFantasyRows({ ...base, lines, values }).rows)).toEqual([1, 2]);
    expect(idsOf(rankFantasyRows({ ...base, dir: "asc", lines, values }).rows)).toEqual([1, 2]);
  });

  it("scores a line the pool has not valued as exactly average", () => {
    const result = rankFantasyRows({
      ...base,
      lines: [line({ playerId: 1 }), line({ playerId: 2 })],
      values: [scores({ playerId: 1, z: -1 })],
    });

    expect(idsOf(result.rows)).toEqual([2, 1]);
    expect(result.rows[0]?.values).toEqual(scores({ playerId: 2 }));
  });

  it("sorts by name and searches the trimmed query", () => {
    const lines = [
      line({ playerId: 1, firstName: "Jalen", lastName: "Brunson" }),
      line({ playerId: 2, firstName: "Luka", lastName: "Doncic" }),
      line({ playerId: 3, firstName: "Jaylen", lastName: "Brown" }),
    ];

    const result = rankFantasyRows({
      ...base,
      q: "  j ",
      dir: "asc",
      sort: "lastName",
      lines,
      values: [],
    });

    expect(idsOf(result.rows)).toEqual([3, 1]);
    expect(result.total).toBe(2);
  });

  it("numbers a later page from where the previous one ended", () => {
    const lines = [1, 2, 3, 4, 5].map((playerId) => line({ playerId }));
    const values = lines.map(({ playerId }) => scores({ playerId, z: -playerId }));

    const result = rankFantasyRows({ ...base, page: 2, size: 2, lines, values });

    expect(idsOf(result.rows)).toEqual([3, 4]);
    expect(result.rows.map((row) => row.rank)).toEqual([3, 4]);
    expect(result).toMatchObject({ total: 5, page: 2 });
  });
});
