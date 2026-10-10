import { type BasketballLine } from "@vision/sport-basketball/types";
import {
  isValuationResponse,
  sameValuationJob,
  type ValuationJob,
  type ValuationRequest,
} from "@/lib/valuation/workerProtocol";
import { type FantasyPlayerValues, type PoolStats } from "@/lib/valuation/types";

// The view's side of the worker, narrowed to what the client needs so tests
// can stand in a fake.
export type ValuationPort = {
  post: (request: ValuationRequest) => void;
  listen: (handlers: { onMessage: (data: unknown) => void; onError: () => void }) => () => void;
  terminate: () => void;
};

export type SettledValuation<L extends BasketballLine> = {
  job: ValuationJob<L>;
  values: FantasyPlayerValues[];
  poolStats: PoolStats;
};

export type ValuationClient<L extends BasketballLine> = {
  request: (job: ValuationJob<L>) => void;
  dispose: () => void;
};

// One job in flight at a time. A job requested meanwhile waits, and a newer
// one replaces it, so dragging a weight queues at most one valuation behind
// the running one instead of one per step. Each settled result carries the
// job that produced it, so the view never pairs values with inputs they were
// not computed from. Any worker failure ends the client: the view falls back
// to valuing on the main thread.
export const createValuationClient = <L extends BasketballLine>({
  port,
  onSettle,
  onFailure,
}: {
  port: ValuationPort;
  onSettle: (settled: SettledValuation<L>) => void;
  onFailure: () => void;
}): ValuationClient<L> => {
  let sentLines: readonly L[] | null = null;
  let linesId = 0;
  let requestId = 0;
  let inFlight: { requestId: number; job: ValuationJob<L> } | null = null;
  let queued: ValuationJob<L> | null = null;
  let failed = false;

  const send = (job: ValuationJob<L>) => {
    if (job.lines !== sentLines) {
      linesId += 1;
      sentLines = job.lines;
      port.post({ type: "lines", linesId, lines: job.lines });
    }
    requestId += 1;
    inFlight = { requestId, job };
    port.post({ type: "value", requestId, linesId, inputs: job.inputs });
  };

  const stopListening = port.listen({
    onMessage: (data) => {
      if (failed || inFlight === null) return;
      if (!isValuationResponse(data) || data.requestId !== inFlight.requestId) return;
      if (data.type === "error") {
        fail();
        return;
      }
      const { job } = inFlight;
      inFlight = null;
      onSettle({ job, values: data.values, poolStats: data.poolStats });
      if (queued !== null) {
        const next = queued;
        queued = null;
        send(next);
      }
    },
    onError: () => fail(),
  });

  const dispose = () => {
    stopListening();
    port.terminate();
  };

  const fail = () => {
    if (failed) return;
    failed = true;
    dispose();
    onFailure();
  };

  return {
    request: (job) => {
      if (failed) return;
      if (inFlight !== null && sameValuationJob({ a: inFlight.job, b: job })) {
        queued = null;
        return;
      }
      if (inFlight !== null) {
        queued = job;
        return;
      }
      send(job);
    },
    dispose,
  };
};
