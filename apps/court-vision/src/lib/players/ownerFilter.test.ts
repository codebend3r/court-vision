import { describe, expect, it } from "bun:test";

import { filterByOwner } from "@/lib/players/ownerFilter";

const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
type IdOfProps = { id: number };

const idOf = (row: IdOfProps) => row.id;
const takenIds = new Set([1, 3]);

describe("filterByOwner", () => {
  it("keeps everyone for the all filter", () => {
    expect(filterByOwner({ rows, owner: "all", takenIds, idOf })).toEqual(rows);
  });

  it("keeps only rostered players for the taken filter", () => {
    expect(filterByOwner({ rows, owner: "taken", takenIds, idOf })).toEqual([{ id: 1 }, { id: 3 }]);
  });

  it("keeps only unrostered players for the free filter", () => {
    expect(filterByOwner({ rows, owner: "free", takenIds, idOf })).toEqual([{ id: 2 }]);
  });

  it("keeps every row when the league's rosters are unknown", () => {
    expect(filterByOwner({ rows, owner: "free", takenIds: null, idOf })).toEqual(rows);
  });
});
