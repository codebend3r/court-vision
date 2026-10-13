import { describe, expect, it } from "bun:test";

import { setColumnWeights } from "@/lib/valuation/weights";

describe("setColumnWeights", () => {
  it("sets the edited column's weights beside the others' untouched sets", () => {
    expect(
      setColumnWeights({ methodWeights: { z: { ast: 2 } }, key: "g", weights: { ast: 0.5 } }),
    ).toEqual({ z: { ast: 2 }, g: { ast: 0.5 } });
  });

  it("replaces the edited column's previous set outright", () => {
    expect(
      setColumnWeights({
        methodWeights: { z: { ast: 2, ft: 0 } },
        key: "z",
        weights: { tov: 0.5 },
      }),
    ).toEqual({ z: { tov: 0.5 } });
  });

  it("drops a column whose set is cleared, and any empty set already stored", () => {
    expect(
      setColumnWeights({ methodWeights: { z: { ast: 2 }, g: {} }, key: "z", weights: {} }),
    ).toEqual({});
  });

  it("lists the columns in registry order whatever order they were stored in", () => {
    const next = setColumnWeights({
      methodWeights: { sim: { pts: 0 }, vorp: { reb: 2 } },
      key: "z",
      weights: { ast: 0 },
    });

    expect(Object.keys(next)).toEqual(["z", "vorp", "sim"]);
  });
});
