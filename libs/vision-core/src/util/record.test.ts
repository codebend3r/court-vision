import { describe, expect, it } from "bun:test";

import { hasEveryKey, isKeyOf, isRecord, recordFromItems, recordFromKeys } from "#core/util/record";

describe("recordFromKeys", () => {
  it("builds one entry per key from the value function", () => {
    expect(recordFromKeys({ keys: ["a", "b"], value: (key) => key.toUpperCase() })).toEqual({
      a: "A",
      b: "B",
    });
  });

  it("builds an empty record from no keys", () => {
    expect(recordFromKeys({ keys: [], value: () => 0 })).toEqual({});
  });
});

describe("recordFromItems", () => {
  it("keys each item's value by the item's own key", () => {
    const specs = [
      { key: "fg", scale: 100 },
      { key: "ft", scale: 1 },
    ];
    expect(recordFromItems({ items: specs, value: (spec) => spec.scale })).toEqual({
      fg: 100,
      ft: 1,
    });
  });

  it("builds an empty record from no items", () => {
    expect(recordFromItems({ items: [], value: () => 0 })).toEqual({});
  });
});

describe("isRecord", () => {
  it("accepts objects and arrays", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(true);
  });

  it("rejects null and primitives", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord("record")).toBe(false);
    expect(isRecord(1)).toBe(false);
  });
});

describe("hasEveryKey", () => {
  it("accepts a record holding every key", () => {
    expect(hasEveryKey({ keys: ["a", "b"] })({ a: 1, b: 2, c: 3 })).toBe(true);
  });

  it("rejects a record missing a key", () => {
    expect(hasEveryKey({ keys: ["a", "b"] })({ a: 1 })).toBe(false);
  });
});

describe("isKeyOf", () => {
  it("recognizes own keys only", () => {
    const guard = isKeyOf({ record: { pts: 1 } });
    expect(guard("pts")).toBe(true);
    expect(guard("toString")).toBe(false);
    expect(guard("reb")).toBe(false);
  });
});
