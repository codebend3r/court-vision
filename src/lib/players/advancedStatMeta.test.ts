import { describe, expect, it } from "vitest";

import { ADVANCED_STAT_META } from "@/lib/players/advancedStatMeta";
import { ADVANCED_METRIC_KEYS } from "@/lib/players/searchParams";

describe("ADVANCED_STAT_META", () => {
  it("covers every advanced metric key exactly once", () => {
    const metaKeys = ADVANCED_STAT_META.map((meta) => meta.key);
    expect(metaKeys).toHaveLength(ADVANCED_METRIC_KEYS.length);
    expect(new Set(metaKeys).size).toBe(metaKeys.length);
    ADVANCED_METRIC_KEYS.map((key) => expect(metaKeys).toContain(key));
  });

  it("has non-empty copy for every entry", () => {
    ADVANCED_STAT_META.forEach((meta) => {
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
