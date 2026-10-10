import { describe, expect, it } from "bun:test";

import { DEFAULT_VALUATION_CONFIG, valuePlayers } from "@vision/sport-basketball/engine";
import { makeStatLine } from "@/lib/valuation/fixtures";
import {
  isCategoryWeights,
  isMethodWeights,
  isPoolStats,
  isValuationConfig,
  isValuationInputs,
  isValuationLine,
  isValuationRequest,
  isValuationResponse,
  sameValuationJob,
  type ValuationInputs,
} from "@/lib/valuation/workerProtocol";

const lines = [1, 2, 3].map((playerId) => makeStatLine({ playerId, pts: 400 + playerId * 100 }));
const inputs: ValuationInputs = {
  config: DEFAULT_VALUATION_CONFIG,
  methodWeights: { z: { ft: 0 } },
  windowGames: null,
};
const { values, poolStats } = valuePlayers({ lines, ...inputs });

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

describe("isValuationInputs", () => {
  it("accepts a whole-season or windowed request", () => {
    expect(isValuationInputs(inputs)).toBe(true);
    expect(isValuationInputs({ ...inputs, windowGames: 10 })).toBe(true);
  });

  it("rejects a missing window or malformed weights", () => {
    expect(isValuationInputs({ ...inputs, windowGames: undefined })).toBe(false);
    expect(isValuationInputs({ ...inputs, methodWeights: { z: 1 } })).toBe(false);
  });
});

describe("isValuationRequest", () => {
  it("accepts a pool message and a value message", () => {
    expect(isValuationRequest({ type: "lines", linesId: 1, lines })).toBe(true);
    expect(isValuationRequest({ type: "value", requestId: 1, linesId: 1, inputs })).toBe(true);
  });

  it("rejects a pool holding a malformed line or an unknown message", () => {
    expect(isValuationRequest({ type: "lines", linesId: 1, lines: [{ playerId: 1 }] })).toBe(false);
    expect(isValuationRequest({ type: "value", requestId: 1, inputs })).toBe(false);
    expect(isValuationRequest({ type: "reset" })).toBe(false);
    expect(isValuationRequest("value")).toBe(false);
  });
});

describe("isPoolStats", () => {
  it("accepts the engine's pool stats", () => {
    expect(isPoolStats(poolStats)).toBe(true);
  });

  it("rejects pool stats missing a category", () => {
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

describe("sameValuationJob", () => {
  it("matches equal inputs held in fresh objects over the same pool", () => {
    const copy: ValuationInputs = {
      config: { ...inputs.config },
      methodWeights: { z: { ft: 0 } },
      windowGames: null,
    };
    expect(sameValuationJob({ a: { lines, inputs }, b: { lines, inputs: copy } })).toBe(true);
  });

  it("tells apart a changed input or a new pool with the same numbers", () => {
    const reweighted = { ...inputs, methodWeights: { z: { ft: 0.5 } } };
    expect(sameValuationJob({ a: { lines, inputs }, b: { lines, inputs: reweighted } })).toBe(
      false,
    );
    expect(sameValuationJob({ a: { lines, inputs }, b: { lines: [...lines], inputs } })).toBe(
      false,
    );
  });
});
