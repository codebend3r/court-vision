import { describe, expect, it } from "bun:test";

import { ADVANCED_STAT_META, formatAdvancedStat } from "@/lib/players/advancedStatMeta";
import { ADVANCED_METRIC_KEYS } from "@/lib/players/searchParams";

describe("ADVANCED_STAT_META", () => {
  it("covers every advanced metric key exactly once", () => {
    const metaKeys = ADVANCED_STAT_META.map((meta) => meta.key);
    expect(metaKeys).toHaveLength(ADVANCED_METRIC_KEYS.length);
    expect(new Set(metaKeys).size).toBe(metaKeys.length);
    ADVANCED_METRIC_KEYS.map((key) => expect(metaKeys).toContain(key));
  });

  it("has non-empty copy for every entry", () => {
    ADVANCED_STAT_META.map((meta) => {
      expect(meta.label).not.toBe("");
      expect(meta.fullName).not.toBe("");
      expect(meta.description).not.toBe("");
      expect(meta.formula).not.toBe("");
    });
  });

  it("has unique labels", () => {
    const labels = ADVANCED_STAT_META.map((meta) => meta.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("ADVANCED_STAT_META kinds", () => {
  it("marks every share-of-something metric as a percentage and the rest as ratings", () => {
    const kindOf = (key: string) => ADVANCED_STAT_META.find((meta) => meta.key === key)?.kind;
    expect(kindOf("pie")).toBe("percentage");
    expect(kindOf("assistPercentage")).toBe("percentage");
    expect(kindOf("defensiveReboundPercentage")).toBe("percentage");
    expect(kindOf("effectiveFieldGoalPercentage")).toBe("percentage");
    expect(kindOf("offensiveReboundPercentage")).toBe("percentage");
    expect(kindOf("reboundPercentage")).toBe("percentage");
    expect(kindOf("trueShootingPercentage")).toBe("percentage");
    expect(kindOf("usagePercentage")).toBe("percentage");
    expect(kindOf("pace")).toBe("rating");
    expect(kindOf("assistRatio")).toBe("rating");
    expect(kindOf("assistToTurnover")).toBe("rating");
    expect(kindOf("defensiveRating")).toBe("rating");
    expect(kindOf("netRating")).toBe("rating");
    expect(kindOf("offensiveRating")).toBe("rating");
    expect(kindOf("turnoverRatio")).toBe("rating");
  });
});

describe("formatAdvancedStat", () => {
  it("renders a stored fraction as a one-decimal percentage", () => {
    expect(formatAdvancedStat({ key: "trueShootingPercentage", value: 0.5876 })).toBe("58.8%");
    expect(formatAdvancedStat({ key: "pie", value: 0.073 })).toBe("7.3%");
  });

  it("renders ratings and ratios to one decimal, sign intact", () => {
    expect(formatAdvancedStat({ key: "pace", value: 104.59 })).toBe("104.6");
    expect(formatAdvancedStat({ key: "netRating", value: -4.6 })).toBe("-4.6");
    expect(formatAdvancedStat({ key: "assistToTurnover", value: 1.17 })).toBe("1.2");
  });

  it("renders a missing value as a dash", () => {
    expect(formatAdvancedStat({ key: "pace", value: null })).toBe("—");
  });
});
