import { describe, expect, it } from "vitest";

import { parseNbaResponse, rowsToObjects, selectResultSet } from "./parse";

const sample = {
  resource: "playerindex",
  parameters: {},
  resultSets: [
    {
      name: "PlayerIndex",
      headers: ["PERSON_ID", "PLAYER_LAST_NAME"],
      rowSet: [
        [1629029, "Doncic"],
        [201939, "Curry"],
      ],
    },
  ],
};

describe("parseNbaResponse", () => {
  it("accepts a valid NBA envelope", () => {
    const parsed = parseNbaResponse(sample);
    expect(parsed.resultSets[0].name).toBe("PlayerIndex");
  });

  it("rejects a malformed envelope", () => {
    expect(() => parseNbaResponse({ nope: true })).toThrow();
  });
});

describe("selectResultSet", () => {
  it("returns the result set matching the name", () => {
    const parsed = parseNbaResponse(sample);
    expect(selectResultSet(parsed, "PlayerIndex").rowSet).toHaveLength(2);
  });

  it("throws when the named result set is absent", () => {
    const parsed = parseNbaResponse(sample);
    expect(() => selectResultSet(parsed, "Missing")).toThrow(/Missing/);
  });
});

describe("rowsToObjects", () => {
  it("zips headers onto each row", () => {
    const parsed = parseNbaResponse(sample);
    const objects = rowsToObjects(selectResultSet(parsed, "PlayerIndex"));
    expect(objects).toEqual([
      { PERSON_ID: 1629029, PLAYER_LAST_NAME: "Doncic" },
      { PERSON_ID: 201939, PLAYER_LAST_NAME: "Curry" },
    ]);
  });

  it("returns an empty array for an empty rowSet", () => {
    expect(rowsToObjects({ name: "x", headers: ["A"], rowSet: [] })).toEqual([]);
  });
});
