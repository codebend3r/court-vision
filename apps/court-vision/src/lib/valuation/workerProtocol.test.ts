import { describe, expect, it } from "bun:test";

import { DEFAULT_VALUATION_CONFIG, valuePlayers } from "@vision/sport-basketball/engine";
import { makeStatLine } from "@/lib/valuation/fixtures";
import {
  isCategoryWeights,
  isMethodWeights,
  isPoolStats,
  isValuationConfig,
  isValuationJob,
  isValuationLine,
  isValuationResponse,
  respondToValuation,
  type ValuationJob,
} from "@/lib/valuation/workerProtocol";

const lines = [1, 2, 3, 4].map((playerId) =>
  makeStatLine({ playerId, pts: 300 + playerId * 150, ftm: 40 * playerId, fta: 200 }),
);
const job: ValuationJob = {
  lines,
  config: DEFAULT_VALUATION_CONFIG,
  methodWeights: { z: { ft: 0 } },
  windowGames: null,
};
const { values, poolStats } = valuePlayers(job);

describe("isCategoryWeights", () => {
  it("accepts numeric weights keyed by category", () => {
    expect(isCategoryWeights({ pts: 1.5, ft: 0 })).toBe(true);
    expect(isCategoryWeights({})).toBe(true);
  });

  it("rejects an unknown category or a non-numeric weight", () => {
    expect(isCategoryWeights({ dunks: 1 })).toBe(false);
    expect(isCategoryWeights({ pts: "1" })).toBe(false);
    expect(isCategoryWeights(null)).toBe(false);
  });
});

describe("isMethodWeights", () => {
  it("accepts weight sets keyed by weighted method", () => {
    expect(isMethodWeights({ z: { ft: 0 }, sim: { tov: 0.5 } })).toBe(true);
  });

  it("rejects an unweighted method key or a malformed weight set", () => {
    expect(isMethodWeights({ points: { pts: 2 } })).toBe(false);
    expect(isMethodWeights({ z: { ft: "0" } })).toBe(false);
  });
});

describe("isValuationLine", () => {
  it("accepts a stat line, identity fields and all", () => {
    expect(isValuationLine(lines[0])).toBe(true);
    expect(isValuationLine({ ...lines[0], position: null })).toBe(true);
  });

  it("rejects a line missing a stat, a second moment, or a cross product", () => {
    const line = makeStatLine({ playerId: 9 });
    const { pts: _pts, ...statsWithoutPts } = line.stats;
    expect(isValuationLine({ ...line, stats: statsWithoutPts })).toBe(false);
    expect(isValuationLine({ ...line, sq: { ...line.sq, reb: "4" } })).toBe(false);
    expect(isValuationLine({ ...line, cross: { fg: 1 } })).toBe(false);
    expect(isValuationLine({ ...line, playerId: "9" })).toBe(false);
  });
});

describe("isValuationConfig", () => {
  it("accepts the default config", () => {
    expect(isValuationConfig(DEFAULT_VALUATION_CONFIG)).toBe(true);
  });

  it("rejects an unknown basis, category, or a missing scoring stat", () => {
    expect(isValuationConfig({ ...DEFAULT_VALUATION_CONFIG, basis: "perMinute" })).toBe(false);
    expect(isValuationConfig({ ...DEFAULT_VALUATION_CONFIG, categories: ["dunks"] })).toBe(false);
    const { pts: _pts, ...scoring } = DEFAULT_VALUATION_CONFIG.scoring;
    expect(isValuationConfig({ ...DEFAULT_VALUATION_CONFIG, scoring })).toBe(false);
  });
});

describe("isValuationJob", () => {
  it("accepts a whole-season or windowed job", () => {
    expect(isValuationJob(job)).toBe(true);
    expect(isValuationJob({ ...job, windowGames: 10 })).toBe(true);
  });

  it("rejects a malformed line, missing window, or malformed weights", () => {
    expect(isValuationJob({ ...job, lines: [{ playerId: 1 }] })).toBe(false);
    expect(isValuationJob({ ...job, windowGames: undefined })).toBe(false);
    expect(isValuationJob({ ...job, methodWeights: { z: 1 } })).toBe(false);
  });
});

describe("isPoolStats", () => {
  it("accepts the engine's pool stats", () => {
    expect(isPoolStats(poolStats)).toBe(true);
  });

  it("rejects pool stats missing a category or a league rate", () => {
    const { pts: _pts, ...byCategory } = poolStats.byCategory;
    expect(isPoolStats({ ...poolStats, byCategory })).toBe(false);
    expect(isPoolStats({ ...poolStats, leagueRate: { fg: 0.5 } })).toBe(false);
  });
});

describe("isValuationResponse", () => {
  it("accepts a result and an error", () => {
    expect(isValuationResponse({ type: "result", requestId: 3, values, poolStats })).toBe(true);
    expect(isValuationResponse({ type: "error", requestId: 3 })).toBe(true);
  });

  it("rejects a reply with no request id or malformed values", () => {
    expect(isValuationResponse({ type: "error" })).toBe(false);
    expect(
      isValuationResponse({ type: "result", requestId: 3, values: [{ playerId: 1 }], poolStats }),
    ).toBe(false);
    expect(isValuationResponse({ type: "result", requestId: 3, values, poolStats: {} })).toBe(
      false,
    );
  });
});

describe("respondToValuation", () => {
  it("values the job exactly as the main thread would", () => {
    expect(respondToValuation({ requestId: 7, job })).toEqual({
      type: "result",
      requestId: 7,
      values,
      poolStats,
    });
  });

  it("errors on a malformed job it can still answer", () => {
    expect(respondToValuation({ requestId: 4, job: { ...job, config: {} } })).toEqual({
      type: "error",
      requestId: 4,
    });
  });

  it("ignores noise with no request to answer", () => {
    expect(respondToValuation({ hello: "worker" })).toBeNull();
    expect(respondToValuation(null)).toBeNull();
  });
});
