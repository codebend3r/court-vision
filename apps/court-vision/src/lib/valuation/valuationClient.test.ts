import { describe, expect, it, vi } from "bun:test";

import { DEFAULT_VALUATION_CONFIG } from "@vision/sport-basketball/engine";
import { fakeValuationWorker } from "@/lib/valuation/fakeValuationWorker";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { createValuationClient, type SettledValuation } from "@/lib/valuation/valuationClient";
import { type FantasyValuationJob } from "@/lib/valuation/workerProtocol";

const lines = [1, 2, 3].map((playerId) => makeStatLine({ playerId, pts: 400 + playerId * 120 }));

const jobWith = ({ teams }: { teams: number }): FantasyValuationJob => ({
  lines,
  config: { ...DEFAULT_VALUATION_CONFIG, teams },
  methodWeights: {},
  windowGames: null,
});

const startClient = () => {
  const worker = fakeValuationWorker();
  const onSettle = vi.fn<(settled: SettledValuation) => void>();
  const onFailure = vi.fn<() => void>();
  const client = createValuationClient({ port: worker.port, onSettle, onFailure });
  return { worker, client, onSettle, onFailure };
};

const settledTeams = (onSettle: ReturnType<typeof startClient>["onSettle"]): number[] =>
  onSettle.mock.calls.map(([settled]) => settled.job.config.teams);

describe("createValuationClient", () => {
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
    expect(worker.posted).toHaveLength(2);
  });

  it("ignores a reply to a request it is not waiting on", () => {
    const { worker, client, onSettle, onFailure } = startClient();

    client.request(jobWith({ teams: 12 }));
    worker.deliver({ type: "error", requestId: 99 });
    worker.deliver({ type: "result", requestId: 1 });

    expect(onSettle).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("fails over when the worker answers with an error", () => {
    const { worker, client, onFailure } = startClient();

    client.request(jobWith({ teams: 12 }));
    worker.deliver({ type: "error", requestId: 1 });
    client.request(jobWith({ teams: 9 }));

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(worker.terminateCount()).toBe(1);
    expect(worker.posted).toHaveLength(1);
  });

  it("fails over once when the worker itself errors", () => {
    const { worker, onFailure } = startClient();

    worker.crash();
    worker.crash();

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(worker.terminateCount()).toBe(1);
  });

  it("terminates the worker and stops listening on dispose", () => {
    const { worker, client, onSettle } = startClient();

    client.request(jobWith({ teams: 12 }));
    client.dispose();
    worker.answer();

    expect(worker.terminateCount()).toBe(1);
    expect(onSettle).not.toHaveBeenCalled();
  });
});
