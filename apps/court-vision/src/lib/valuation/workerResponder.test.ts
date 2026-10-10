import { describe, expect, it } from "bun:test";

import { DEFAULT_VALUATION_CONFIG, valuePlayers } from "@vision/sport-basketball/engine";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type ValuationInputs } from "@/lib/valuation/workerProtocol";
import { createValuationResponder } from "@/lib/valuation/workerResponder";

const lines = [1, 2, 3, 4].map((playerId) =>
  makeStatLine({ playerId, pts: 300 + playerId * 150, ftm: 40 * playerId, fta: 200 }),
);
const inputs: ValuationInputs = {
  config: DEFAULT_VALUATION_CONFIG,
  methodWeights: {},
  windowGames: null,
};

describe("createValuationResponder", () => {
  it("values the held pool exactly as the main thread would", () => {
    const respond = createValuationResponder();
    expect(respond({ type: "lines", linesId: 1, lines })).toBeNull();

    const response = respond({ type: "value", requestId: 7, linesId: 1, inputs });

    expect(response).toEqual({
      type: "result",
      requestId: 7,
      ...valuePlayers({ lines, ...inputs }),
    });
  });

  it("answers against the newest pool once a second one arrives", () => {
    const respond = createValuationResponder();
    const narrower = lines.slice(0, 2);
    respond({ type: "lines", linesId: 1, lines });
    respond({ type: "lines", linesId: 2, lines: narrower });

    const response = respond({ type: "value", requestId: 8, linesId: 2, inputs });

    expect(response).toEqual({
      type: "result",
      requestId: 8,
      ...valuePlayers({ lines: narrower, ...inputs }),
    });
  });

  it("errors on a request for a pool it does not hold", () => {
    const respond = createValuationResponder();
    expect(respond({ type: "value", requestId: 1, linesId: 1, inputs })).toEqual({
      type: "error",
      requestId: 1,
    });
    respond({ type: "lines", linesId: 2, lines });
    expect(respond({ type: "value", requestId: 2, linesId: 1, inputs })).toEqual({
      type: "error",
      requestId: 2,
    });
  });

  it("errors on a malformed request it can still answer, and ignores noise", () => {
    const respond = createValuationResponder();
    expect(respond({ type: "value", requestId: 4, linesId: 1, inputs: {} })).toEqual({
      type: "error",
      requestId: 4,
    });
    expect(respond({ hello: "worker" })).toBeNull();
    expect(respond(null)).toBeNull();
  });
});
