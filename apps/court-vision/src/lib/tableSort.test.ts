import { describe, expect, it } from "bun:test";

import { ariaSortFor, nextSort, sortRows, type SortColumn } from "@/lib/tableSort";

describe("nextSort", () => {
  it("starts a new column in its first direction", () => {
    expect(nextSort({ current: null, key: "pts", firstDir: "desc" })).toEqual({
      key: "pts",
      dir: "desc",
    });
    expect(
      nextSort({ current: { key: "name", dir: "asc" }, key: "pts", firstDir: "desc" }),
    ).toEqual({ key: "pts", dir: "desc" });
  });

  it("flips on a second click, then clears on a third", () => {
    const first = nextSort({ current: null, key: "pts", firstDir: "desc" });
    const second = nextSort({ current: first, key: "pts", firstDir: "desc" });
    expect(second).toEqual({ key: "pts", dir: "asc" });
    expect(nextSort({ current: second, key: "pts", firstDir: "desc" })).toBeNull();
  });

  it("cycles an ascending-first column the other way round", () => {
    const first = nextSort({ current: null, key: "name", firstDir: "asc" });
    const second = nextSort({ current: first, key: "name", firstDir: "asc" });
    expect(second).toEqual({ key: "name", dir: "desc" });
    expect(nextSort({ current: second, key: "name", firstDir: "asc" })).toBeNull();
  });
});

type Row = { id: number; name: string; pts: number | null };

const columns: SortColumn<Row>[] = [
  { key: "name", firstDir: "asc", valueOf: (row) => row.name },
  { key: "pts", firstDir: "desc", valueOf: (row) => row.pts },
];

const rows: Row[] = [
  { id: 1, name: "Cole", pts: 10 },
  { id: 2, name: "Abe", pts: null },
  { id: 3, name: "Bea", pts: 30 },
  { id: 4, name: "Dee", pts: 10 },
];

const ids = (sorted: Row[]): number[] => sorted.map((row) => row.id);

describe("sortRows", () => {
  it("keeps the given order with no sort", () => {
    expect(ids(sortRows({ rows, sort: null, columns }))).toEqual([1, 2, 3, 4]);
  });

  it("does not touch the rows it was given", () => {
    sortRows({ rows, sort: { key: "name", dir: "asc" }, columns });
    expect(ids(rows)).toEqual([1, 2, 3, 4]);
  });

  it("orders text alphabetically, either way", () => {
    expect(ids(sortRows({ rows, sort: { key: "name", dir: "asc" }, columns }))).toEqual([
      2, 3, 1, 4,
    ]);
    expect(ids(sortRows({ rows, sort: { key: "name", dir: "desc" }, columns }))).toEqual([
      4, 1, 3, 2,
    ]);
  });

  it("orders numbers by size, ties in their given order", () => {
    expect(ids(sortRows({ rows, sort: { key: "pts", dir: "desc" }, columns }))).toEqual([
      3, 1, 4, 2,
    ]);
    expect(ids(sortRows({ rows, sort: { key: "pts", dir: "asc" }, columns }))).toEqual([
      1, 4, 3, 2,
    ]);
  });

  it("sinks a row with no value to the bottom in both directions", () => {
    expect(ids(sortRows({ rows, sort: { key: "pts", dir: "desc" }, columns })).at(-1)).toBe(2);
    expect(ids(sortRows({ rows, sort: { key: "pts", dir: "asc" }, columns })).at(-1)).toBe(2);
  });

  it("leaves the order alone for a column it doesn't know", () => {
    expect(ids(sortRows({ rows, sort: { key: "nope", dir: "asc" }, columns }))).toEqual([
      1, 2, 3, 4,
    ]);
  });
});

describe("ariaSortFor", () => {
  it("names the sorted column's direction and no other", () => {
    const sort = { key: "pts", dir: "desc" } as const;
    expect(ariaSortFor({ sort, key: "pts" })).toBe("descending");
    expect(ariaSortFor({ sort: { key: "pts", dir: "asc" }, key: "pts" })).toBe("ascending");
    expect(ariaSortFor({ sort, key: "name" })).toBeUndefined();
    expect(ariaSortFor({ sort: null, key: "pts" })).toBeUndefined();
  });
});
