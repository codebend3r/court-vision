import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { useValuation } from "@/components/FantasyValueView/useValuation";
import { DEFAULT_VALUATION_CONFIG, valuePlayers } from "@vision/sport-basketball/engine";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type FantasyStatLine, type ValuationConfig } from "@/lib/valuation/types";
import { type ValuationPort } from "@/lib/valuation/valuationClient";
import { type ValuationRequest } from "@/lib/valuation/workerProtocol";
import { createValuationResponder } from "@/lib/valuation/workerResponder";

afterEach(cleanup);

// Alpha scores; Beta shoots free throws. Punting FT% flips which one leads
// Z-Score, so a settled punt is visible in the values.
const lines: FantasyStatLine[] = [
  makeStatLine({ playerId: 1, pts: 1400, ftm: 100, fta: 300 }),
  makeStatLine({ playerId: 2, pts: 1100, ftm: 280, fta: 300 }),
  ...[3, 4, 5].map((playerId) => makeStatLine({ playerId })),
];
const allCategories = DEFAULT_VALUATION_CONFIG;
const puntFt: ValuationConfig = {
  ...DEFAULT_VALUATION_CONFIG,
  categories: DEFAULT_VALUATION_CONFIG.categories.filter((key) => key !== "ft"),
};

const zOf = ({
  values,
  playerId,
}: {
  values: { playerId: number; z: number }[];
  playerId: number;
}) => values.find((value) => value.playerId === playerId)?.z ?? Number.NaN;

// A worker that only answers when told to, running the real responder.
const heldWorker = () => {
  const posted: ValuationRequest[] = [];
  const answered = { count: 0 };
  const listeners: { onMessage: (data: unknown) => void; onError: () => void }[] = [];
  const respond = createValuationResponder();
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
    terminate: () => undefined,
  };
  const answer = () => {
    const pending = posted.slice(answered.count);
    answered.count = posted.length;
    pending.forEach((request) => {
      const response = respond(request);
      if (response !== null) listeners.forEach((handlers) => handlers.onMessage(response));
    });
  };
  const crash = () => listeners.forEach((handlers) => handlers.onError());
  return { createPort: () => port, posted, answer, crash };
};

const renderValuation = ({ createPort }: { createPort: () => ValuationPort | null }) =>
  renderHook(
    ({ config }: { config: ValuationConfig }) =>
      useValuation({ lines, config, methodWeights: {}, windowGames: null, createPort }),
    { initialProps: { config: allCategories } },
  );

describe("useValuation", () => {
  it("values the pool on the first render, before any worker answers", () => {
    const worker = heldWorker();
    const { result } = renderValuation(worker);

    expect(result.current.isPending).toBe(false);
    expect(result.current.values).toEqual(
      valuePlayers({ lines, config: allCategories, methodWeights: {}, windowGames: null }).values,
    );
    expect(worker.posted).toHaveLength(0);
  });

  it("keeps the settled values and their inputs on screen until the worker answers", () => {
    const worker = heldWorker();
    const { result, rerender } = renderValuation(worker);
    const before = result.current.values;

    rerender({ config: puntFt });

    expect(result.current.isPending).toBe(true);
    expect(result.current.values).toBe(before);
    expect(result.current.job.inputs.config).toBe(allCategories);
    expect(worker.posted.map((request) => request.type)).toEqual(["lines", "value"]);

    act(() => worker.answer());

    expect(result.current.isPending).toBe(false);
    expect(result.current.job.inputs.config).toBe(puntFt);
    expect(zOf({ values: result.current.values, playerId: 1 })).toBeGreaterThan(
      zOf({ values: result.current.values, playerId: 2 }),
    );
  });

  it("values on the main thread when no worker can start", () => {
    const { result, rerender } = renderValuation({ createPort: () => null });

    rerender({ config: puntFt });

    expect(result.current.isPending).toBe(false);
    expect(result.current.job.inputs.config).toBe(puntFt);
  });

  it("falls back to the main thread when the worker fails mid-request", () => {
    const worker = heldWorker();
    const { result, rerender } = renderValuation(worker);

    rerender({ config: puntFt });
    act(() => worker.crash());

    expect(result.current.isPending).toBe(false);
    expect(result.current.values).toEqual(
      valuePlayers({ lines, config: puntFt, methodWeights: {}, windowGames: null }).values,
    );
  });

  it("does not ask the worker again for inputs that only changed identity", () => {
    const worker = heldWorker();
    const { result, rerender } = renderValuation(worker);

    rerender({ config: { ...allCategories } });

    expect(result.current.isPending).toBe(false);
    expect(worker.posted).toHaveLength(0);
  });
});
