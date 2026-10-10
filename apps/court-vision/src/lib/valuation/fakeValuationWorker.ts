import { type ValuationPort } from "@/lib/valuation/valuationClient";
import { respondToValuation, type ValuationRequest } from "@/lib/valuation/workerProtocol";

// Test double for the valuation worker. It records what the client posts and
// answers only when told to, running the real worker logic over everything
// not yet answered, in order, so tests control exactly when a job settles.
export const fakeValuationWorker = () => {
  const posted: ValuationRequest[] = [];
  const answered = { count: 0 };
  const terminated = { count: 0 };
  const listeners: { onMessage: (data: unknown) => void; onError: () => void }[] = [];
  const port: ValuationPort = {
    post: (request) => {
      posted.push(request);
    },
    listen: (handlers) => {
      listeners.push(handlers);
      return () => {
        listeners.splice(listeners.indexOf(handlers), 1);
      };
    },
    terminate: () => {
      terminated.count += 1;
    },
  };
  const deliver = (data: unknown) => listeners.forEach((handlers) => handlers.onMessage(data));
  const answer = () => {
    const pending = posted.slice(answered.count);
    answered.count = posted.length;
    pending.forEach((request) => {
      const response = respondToValuation(request);
      if (response !== null) deliver(response);
    });
  };
  const crash = () => listeners.forEach((handlers) => handlers.onError());
  return {
    createPort: () => port,
    port,
    posted,
    answer,
    deliver,
    crash,
    terminateCount: () => terminated.count,
  };
};
