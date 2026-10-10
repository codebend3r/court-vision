import { valuePlayers } from "@vision/sport-basketball/engine";
import { type BasketballLine } from "@vision/sport-basketball/types";
import { isValuationRequest, type ValuationResponse } from "@/lib/valuation/workerProtocol";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// The valuation worker's logic, kept apart from its `self` wiring so it runs
// under test without a worker. It holds the latest pool and answers each
// value request against it. Null means there is nothing to send back: a pool
// message, or noise with no request to answer.
export const createValuationResponder = (): ((data: unknown) => ValuationResponse | null) => {
  let pool: { linesId: number; lines: readonly BasketballLine[] } | null = null;
  return (data) => {
    if (!isValuationRequest(data)) {
      // A malformed request still gets an answer, so the view never waits on
      // a reply that is not coming.
      return isRecord(data) && typeof data.requestId === "number"
        ? { type: "error", requestId: data.requestId }
        : null;
    }
    if (data.type === "lines") {
      pool = { linesId: data.linesId, lines: data.lines };
      return null;
    }
    if (pool === null || pool.linesId !== data.linesId) {
      return { type: "error", requestId: data.requestId };
    }
    try {
      const { values, poolStats } = valuePlayers({ lines: pool.lines, ...data.inputs });
      return { type: "result", requestId: data.requestId, values, poolStats };
    } catch {
      return { type: "error", requestId: data.requestId };
    }
  };
};
