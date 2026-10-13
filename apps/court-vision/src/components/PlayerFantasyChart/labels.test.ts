import { describe, expect, it } from "bun:test";

import {
  METHOD_KEYS,
  METHOD_LABELS,
  methodColors,
  symmetricDomain,
} from "@/components/PlayerFantasyChart/labels";
import { getSeriesPalette } from "@vision/ui/charts/palette";

describe("METHOD_LABELS", () => {
  it("names both series, in palette slot order", () => {
    expect(METHOD_KEYS).toEqual(["z", "g"]);
    expect(METHOD_LABELS).toEqual({ z: "Z-Score", g: "G-Score" });
  });
});

describe("methodColors", () => {
  it("takes the theme's first two series colours", () => {
    const palette = getSeriesPalette({ theme: "light" });

    expect(methodColors({ theme: "light" })).toEqual({ z: palette[0], g: palette[1] });
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
