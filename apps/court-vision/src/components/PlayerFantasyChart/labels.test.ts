import { describe, expect, it } from "bun:test";

import { METHOD_KEYS, symmetricDomain, valueColors } from "@/components/PlayerFantasyChart/labels";
import { getSeriesPalette } from "@vision/ui/charts/palette";
import { LABEL_BY_VALUE_KEY, METHOD_VALUE_KEYS } from "@vision/core/valuation/registry";

describe("METHOD_KEYS", () => {
  it("is Z and G, in palette slot order, named by the registry", () => {
    expect(METHOD_KEYS).toEqual(["z", "g"]);
    expect(METHOD_KEYS.map((key) => LABEL_BY_VALUE_KEY[key])).toEqual(["Z-Score", "G-Score"]);
  });
});

describe("valueColors", () => {
  it("gives Z and G the theme's first two series colours", () => {
    const palette = getSeriesPalette({ theme: "light" });
    const colors = valueColors({ theme: "light" });

    expect(colors.z).toBe(palette[0]);
    expect(colors.g).toBe(palette[1]);
  });

  it("colours every method", () => {
    expect(Object.keys(valueColors({ theme: "light" }))).toEqual([...METHOD_VALUE_KEYS]);
  });
});

describe("symmetricDomain", () => {
  it("is symmetric around zero at the widest Z or G", () => {
    expect(
      symmetricDomain({
        points: [
          { z: 2.4, g: 1.9 },
          { z: -1.2, g: -3.5 },
        ],
      }),
    ).toEqual([-3.5, 3.5]);
  });

  it("keeps one standard deviation of headroom for near-average points", () => {
    expect(symmetricDomain({ points: [{ z: 0.2, g: 0.16 }] })).toEqual([-1, 1]);
    expect(symmetricDomain({ points: [] })).toEqual([-1, 1]);
  });

  it("reads a missing value as zero", () => {
    expect(symmetricDomain({ points: [{ z: null, g: -2 }] })).toEqual([-2, 2]);
  });
});
