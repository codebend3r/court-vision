import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { useValuation } from "@/components/FantasyValueView/useValuation";
import { DEFAULT_VALUATION_CONFIG, valuePlayers } from "@vision/sport-basketball/engine";
import { fakeValuationWorker } from "@/lib/valuation/fakeValuationWorker";
import { makeStatLine } from "@/lib/valuation/fixtures";
import {
  type FantasyPlayerValues,
  type FantasyStatLine,
  type ValuationConfig,
} from "@/lib/valuation/types";
import { type ValuationPort } from "@/lib/valuation/valuationClient";

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
const methodWeights = {};

const zOf = ({ values, playerId }: { values: FantasyPlayerValues[]; playerId: number }) =>
  values.find((value) => value.playerId === playerId)?.z ?? Number.NaN;

const valuesFor = ({ config }: { config: ValuationConfig }) =>
  valuePlayers({ lines, config, methodWeights, windowGames: null }).values;

const renderValuation = ({ createPort }: { createPort: () => ValuationPort | null }) =>
  renderHook(
    ({ config }: { config: ValuationConfig }) =>
      useValuation({ lines, config, methodWeights, windowGames: null, createPort }),
    { initialProps: { config: allCategories } },
  );

describe("useValuation", () => {
  it("values the pool on the first render, before any worker answers", () => {
    const worker = fakeValuationWorker();
    const { result } = renderValuation(worker);

    expect(result.current.isPending).toBe(false);
    expect(result.current.values).toEqual(valuesFor({ config: allCategories }));
    expect(worker.posted).toHaveLength(0);
  });

  it("keeps the settled values and their config on screen until the worker answers", () => {
    const worker = fakeValuationWorker();
    const { result, rerender } = renderValuation(worker);
    const before = result.current.values;

    rerender({ config: puntFt });

    expect(result.current.isPending).toBe(true);
    expect(result.current.values).toBe(before);
    expect(result.current.config).toBe(allCategories);
    expect(worker.posted).toHaveLength(1);

    act(() => worker.answer());

    expect(result.current.isPending).toBe(false);
    expect(result.current.config).toBe(puntFt);
    expect(zOf({ values: result.current.values, playerId: 1 })).toBeGreaterThan(
      zOf({ values: result.current.values, playerId: 2 }),
    );
  });

  it("does not revalue a rerender with the same inputs", () => {
    const worker = fakeValuationWorker();
    const { result, rerender } = renderValuation(worker);

    rerender({ config: allCategories });

    expect(result.current.isPending).toBe(false);
    expect(worker.posted).toHaveLength(0);
  });

  it("values on the main thread when no worker can start", () => {
    const { result, rerender } = renderValuation({ createPort: () => null });

    rerender({ config: puntFt });

    expect(result.current.isPending).toBe(false);
    expect(result.current.config).toBe(puntFt);
    expect(result.current.values).toEqual(valuesFor({ config: puntFt }));
  });

  it("falls back to the main thread when the worker fails mid-request", () => {
    const worker = fakeValuationWorker();
    const { result, rerender } = renderValuation(worker);

    rerender({ config: puntFt });
    act(() => worker.crash());

    expect(result.current.isPending).toBe(false);
    expect(result.current.values).toEqual(valuesFor({ config: puntFt }));
  });
});
