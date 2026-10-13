import { describe, expect, it } from "bun:test";

import {
  compareByName,
  isNameSort,
  matchesQuery,
  pageOf,
  rankRows,
  type NamedRow,
} from "@/lib/players/rank";

const named = ({ id, firstName, lastName }: Omit<NamedRow, "fullName">): NamedRow => ({
  id,
  firstName,
  lastName,
  fullName: `${firstName} ${lastName}`,
});

// A row that nests its identity, the way a scored line does.
type ScoredRow = { player: NamedRow; value: number | null };

const scored = ({
  id,
  firstName = `First${id}`,
  lastName = `Last${id}`,
  value = null,
}: {
  id: number;
  firstName?: string;
  lastName?: string;
  value?: number | null;
}): ScoredRow => ({ player: named({ id, firstName, lastName }), value });

const nameOf = (row: ScoredRow): NamedRow => row.player;

const byValue = {
  by: "value",
  valueOf: (row: ScoredRow) => ({ sink: row.value === null, value: row.value ?? 0 }),
} as const;

const idsOf = (rows: readonly ScoredRow[]): number[] => rows.map((row) => row.player.id);

describe("isNameSort", () => {
  it("accepts the two name sorts", () => {
    expect(isNameSort("firstName")).toBe(true);
    expect(isNameSort("lastName")).toBe(true);
  });

  it("rejects a stat sort and an empty string", () => {
    expect(isNameSort("pts")).toBe(false);
    expect(isNameSort("fullName")).toBe(false);
    expect(isNameSort("")).toBe(false);
  });
});

describe("matchesQuery", () => {
  it("matches every name for an empty query", () => {
    expect(matchesQuery({ fullName: "Stephen Curry", q: "" })).toBe(true);
  });

  it("matches a case-insensitive substring and rejects a miss", () => {
    expect(matchesQuery({ fullName: "Stephen Curry", q: "phen cu" })).toBe(true);
    expect(matchesQuery({ fullName: "Stephen Curry", q: "james" })).toBe(false);
  });
});

describe("compareByName", () => {
  it("falls back to id ascending for identical names in either direction", () => {
    const a = { id: 2, firstName: "Jalen", lastName: "Williams", fullName: "Jalen Williams" };
    const b = { id: 1, firstName: "Jalen", lastName: "Williams", fullName: "Jalen Williams" };

    expect(compareByName({ a, b, sort: "lastName", dir: "asc" })).toBeGreaterThan(0);
    expect(compareByName({ a, b, sort: "lastName", dir: "desc" })).toBeGreaterThan(0);
  });
});

describe("pageOf", () => {
  it("slices the requested page", () => {
    expect(pageOf({ rows: [1, 2, 3, 4, 5], page: 2, size: 2 })).toEqual({
      rows: [3, 4],
      total: 5,
      page: 2,
    });
  });

  it("clamps to the last page and reports page 1 for an empty list", () => {
    expect(pageOf({ rows: [1, 2, 3], page: 5, size: 2 })).toEqual({
      rows: [3],
      total: 3,
      page: 2,
    });
    expect(pageOf({ rows: [], page: 3, size: 2 })).toEqual({ rows: [], total: 0, page: 1 });
  });
});

describe("rankRows", () => {
  const base = { nameOf, q: "", page: 1, size: 10, dir: "desc" } as const;

  it("reads names through the accessor to filter and name-sort nested rows", () => {
    const rows = [
      scored({ id: 1, firstName: "Jalen", lastName: "Brunson" }),
      scored({ id: 2, firstName: "Luka", lastName: "Doncic" }),
      scored({ id: 3, firstName: "Jaylen", lastName: "Brown" }),
    ];

    const result = rankRows({
      ...base,
      rows,
      q: "j",
      dir: "asc",
      order: { by: "name", sort: "lastName" },
    });

    expect(idsOf(result.rows)).toEqual([3, 1]);
    expect(result.total).toBe(2);
  });

  it("sinks rows in either direction and breaks value ties by name ascending", () => {
    const rows = [
      scored({ id: 1, value: null }),
      scored({ id: 2, lastName: "Zed", value: 5 }),
      scored({ id: 3, lastName: "Abe", value: 5 }),
      scored({ id: 4, value: 9 }),
    ];

    const descending = rankRows({ ...base, rows, order: byValue });
    const ascending = rankRows({ ...base, rows, dir: "asc", order: byValue });

    expect(idsOf(descending.rows)).toEqual([4, 3, 2, 1]);
    expect(idsOf(ascending.rows)).toEqual([3, 2, 4, 1]);
  });

  it("breaks value ties by id alone when asked, in either direction", () => {
    const rows = [
      scored({ id: 3, lastName: "Abe", value: 5 }),
      scored({ id: 1, lastName: "Zed", value: 5 }),
      scored({ id: 2, value: 9 }),
    ];
    const byValueThenId = { ...byValue, tiebreak: "id" } as const;

    const descending = rankRows({ ...base, rows, order: byValueThenId });
    const ascending = rankRows({ ...base, rows, dir: "asc", order: byValueThenId });

    expect(idsOf(descending.rows)).toEqual([2, 1, 3]);
    expect(idsOf(ascending.rows)).toEqual([1, 3, 2]);
  });

  it("orders the whole list before cutting the page", () => {
    const rows = Array.from({ length: 5 }, (_, index) => scored({ id: index + 1, value: index }));

    const result = rankRows({ ...base, rows, size: 2, page: 2, order: byValue });

    expect(idsOf(result.rows)).toEqual([3, 2]);
    expect(result).toMatchObject({ total: 5, page: 2 });
  });
});
