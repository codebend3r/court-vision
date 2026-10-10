import { describe, expect, it, vi } from "bun:test";

import { DEFAULT_VALUATION_CONFIG } from "@vision/sport-basketball/engine";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type FantasyStatLine } from "@/lib/valuation/types";
import {
  createValuationClient,
  type SettledValuation,
  type ValuationPort,
} from "@/lib/valuation/valuationClient";
import { type ValuationJob, type ValuationRequest } from "@/lib/valuation/workerProtocol";
import { createValuationResponder } from "@/lib/valuation/workerResponder";

const lines = [1, 2, 3].map((playerId) => makeStatLine({ playerId, pts: 400 + playerId * 120 }));

const jobWith = ({
  teams = 12,
  pool = lines,
}: {
  teams?: number;
  pool?: readonly FantasyStatLine[];
}): ValuationJob<FantasyStatLine> => ({
  lines: pool,
  inputs: { config: { ...DEFAULT_VALUATION_CONFIG, teams }, methodWeights: {}, windowGames: null },
});

// A stand-in worker: it records what the client posts, and `answer` runs the
// real responder over everything not yet answered, in order.
const fakeWorker = () => {
  const posted: ValuationRequest[] = [];
  const answered = { count: 0 };
  const respond = createValuationResponder();
  const listeners: { onMessage: (data: unknown) => void; onError: () => void }[] = [];
  const terminate = vi.fn<() => void>();
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
    terminate,
  };
  const deliver = (data: unknown) => listeners.forEach((handlers) => handlers.onMessage(data));
  const answer = () => {
    const pending = posted.slice(answered.count);
    answered.count = posted.length;
    pending.forEach((request) => {
      const response = respond(request);
      if (response !== null) deliver(response);
    });
  };
  const crash = () => listeners.forEach((handlers) => handlers.onError());
  return { port, posted, answer, deliver, crash, terminate };
};

const startClient = () => {
  const worker = fakeWorker();
  const onSettle = vi.fn<(settled: SettledValuation<FantasyStatLine>) => void>();
  const onFailure = vi.fn<() => void>();
  const client = createValuationClient<FantasyStatLine>({
    port: worker.port,
    onSettle,
    onFailure,
  });
  return { worker, client, onSettle, onFailure };
};

const settledTeams = (onSettle: ReturnType<typeof startClient>["onSettle"]): number[] =>
  onSettle.mock.calls.map(([settled]) => settled.job.inputs.config.teams);

describe("createValuationClient", () => {
  it("sends the pool once, then only inputs for each later job", () => {
    const { worker, client } = startClient();

    client.request(jobWith({ teams: 10 }));
    worker.answer();
    client.request(jobWith({ teams: 14 }));

    expect(worker.posted.map((request) => request.type)).toEqual(["lines", "value", "value"]);
  });

  it("settles each result with the job that produced it", () => {
    const { worker, client, onSettle } = startClient();
    const job = jobWith({ teams: 10 });

    client.request(job);
    worker.answer();

    expect(onSettle).toHaveBeenCalledTimes(1);
    const settled = onSettle.mock.calls[0]?.[0];
    expect(settled?.job).toBe(job);
    expect(settled?.values.map((value) => value.playerId)).toEqual([1, 2, 3]);
  });

  it("queues only the newest job behind the one in flight", () => {
    const { worker, client, onSettle } = startClient();

    client.request(jobWith({ teams: 8 }));
    client.request(jobWith({ teams: 9 }));
    client.request(jobWith({ teams: 10 }));
    worker.answer();
    worker.answer();

    expect(settledTeams(onSettle)).toEqual([8, 10]);
    expect(worker.posted.filter((request) => request.type === "value")).toHaveLength(2);
  });

  it("drops a queued job when the in-flight one is asked for again", () => {
    const { worker, client, onSettle } = startClient();

    client.request(jobWith({ teams: 8 }));
    client.request(jobWith({ teams: 9 }));
    client.request(jobWith({ teams: 8 }));
    worker.answer();

    expect(settledTeams(onSettle)).toEqual([8]);
    expect(worker.posted.filter((request) => request.type === "value")).toHaveLength(1);
  });

  it("resends the pool when the job carries a new one", () => {
    const { worker, client } = startClient();

    client.request(jobWith({}));
    worker.answer();
    client.request(jobWith({ pool: lines.slice(0, 2) }));

    expect(worker.posted.map((request) => request.type)).toEqual([
      "lines",
      "value",
      "lines",
      "value",
    ]);
  });

  it("ignores a reply to a request it is not waiting on", () => {
    const { worker, client, onSettle } = startClient();

    client.request(jobWith({}));
    worker.deliver({ type: "error", requestId: 99 });
    worker.deliver({ type: "result", requestId: 1 });

    expect(onSettle).not.toHaveBeenCalled();
  });

  it("fails over when the worker answers with an error", () => {
    const { worker, client, onFailure } = startClient();

    client.request(jobWith({}));
    worker.deliver({ type: "error", requestId: 1 });
    client.request(jobWith({ teams: 9 }));

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(worker.posted.filter((request) => request.type === "value")).toHaveLength(1);
  });

  it("fails over once when the worker itself errors", () => {
    const { worker, onFailure } = startClient();

    worker.crash();
    worker.crash();

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("terminates the worker and stops listening on dispose", () => {
    const { worker, client, onSettle } = startClient();

    client.request(jobWith({}));
    client.dispose();
    worker.answer();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(onSettle).not.toHaveBeenCalled();
  });
});
