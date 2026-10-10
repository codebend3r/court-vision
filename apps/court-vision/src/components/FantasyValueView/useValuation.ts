import { useEffect, useMemo, useState } from "react";

import { valuePlayers } from "@vision/sport-basketball/engine";
import {
  createValuationClient,
  type SettledValuation,
  type ValuationClient,
  type ValuationPort,
} from "@/lib/valuation/valuationClient";
import { createValuationPort } from "@/lib/valuation/valuationPort";
import { type FantasyValuationJob } from "@/lib/valuation/workerProtocol";
import { type FantasyPlayerValues, type PoolStats } from "@/lib/valuation/types";

const valueNow = (job: FantasyValuationJob): SettledValuation => ({ job, ...valuePlayers(job) });

// The settled values and the job they were computed from, flattened, plus
// whether a newer job is still being valued.
export type Valuation = FantasyValuationJob & {
  values: FantasyPlayerValues[];
  poolStats: PoolStats;
  isPending: boolean;
};

// Every method's score for the whole pool, computed in a worker so a weight
// or league-size change never blocks the main thread. The first render values
// synchronously: the server render has no worker, and hydration must match
// the HTML it produced. After that the latest settled result stays on screen,
// flagged pending, until the worker answers for the current job. Without a
// worker (or after one fails) each change values on the main thread instead.
//
// The returned lines, config and weights are the ones the values were
// computed from, which trail the requested ones while pending. Anything
// derived from the values must read them from here, not from its own inputs.
// The job is memoized on its inputs' identities: the URL state hands back
// the same objects until a param actually changes. `createPort` is read once,
// on mount.
export const useValuation = ({
  lines,
  config,
  methodWeights,
  windowGames,
  createPort = createValuationPort,
}: FantasyValuationJob & { createPort?: () => ValuationPort | null }): Valuation => {
  const job = useMemo(
    (): FantasyValuationJob => ({ lines, config, methodWeights, windowGames }),
    [lines, config, methodWeights, windowGames],
  );
  const [settled, setSettled] = useState(() => valueNow(job));
  const [client, setClient] = useState<ValuationClient | null>(null);

  useEffect(() => {
    const port = createPort();
    if (port === null) return;
    const next = createValuationClient({
      port,
      onSettle: setSettled,
      onFailure: () => setClient(null),
    });
    setClient(next);
    return () => next.dispose();
    // Started once per mount; a new port factory mid-life is not supported.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPending = settled.job !== job;

  useEffect(() => {
    if (!isPending) return;
    if (client === null) {
      setSettled(valueNow(job));
      return;
    }
    client.request(job);
  }, [isPending, job, client]);

  return { ...settled.job, values: settled.values, poolStats: settled.poolStats, isPending };
};
