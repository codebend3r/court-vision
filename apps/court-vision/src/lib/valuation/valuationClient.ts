import {
  isValuationResponse,
  type FantasyValuationJob,
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

// A finished valuation, kept with the job that produced it.
export type SettledValuation = {
  job: FantasyValuationJob;
  values: FantasyPlayerValues[];
  poolStats: PoolStats;
};

export type ValuationClient = {
  request: (job: FantasyValuationJob) => void;
  dispose: () => void;
};

// One job in flight at a time. A job requested meanwhile waits, and a newer
// one replaces it, so dragging a weight queues at most one valuation behind
// the running one instead of one per step. Any worker failure ends the
// client: the view falls back to valuing on the main thread.
export const createValuationClient = ({
  port,
  onSettle,
  onFailure,
}: {
  port: ValuationPort;
  onSettle: (settled: SettledValuation) => void;
  onFailure: () => void;
}): ValuationClient => {
  let requestId = 0;
  let inFlight: { requestId: number; job: FantasyValuationJob } | null = null;
  let queued: FantasyValuationJob | null = null;
  let failed = false;

  const send = (job: FantasyValuationJob) => {
    requestId += 1;
    inFlight = { requestId, job };
    port.post({ requestId, job });
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
      if (inFlight !== null) {
        queued = job;
        return;
      }
      send(job);
    },
    dispose,
  };
};
