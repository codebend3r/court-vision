import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { type FantasyTrendLogsResult } from "@/lib/valuation/trendLogs";

type LoadTrendLogsProps = { playerIds: number[] };

type LoadTrendLogs = (args: LoadTrendLogsProps) => Promise<FantasyTrendLogsResult>;

const load = vi.fn<LoadTrendLogs>();

// The default loader is a server action; keep its Prisma import out of the run.
vi.mock("@/lib/valuation/actions", () => ({ loadFantasyTrendLogs: load }));

import { useTrendLogs } from "@/components/FantasyValueView/useTrendLogs";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type FantasyStatLine } from "@/lib/valuation/types";

afterEach(cleanup);

const lines: FantasyStatLine[] = [1, 2, 3].map((playerId) => makeStatLine({ playerId }));
type RowsForProps = { ids: readonly number[] };

const rowsFor = ({ ids }: RowsForProps) => ids.map((playerId) => ({ playerId }));

type HookProps = {
  enabled: boolean;
  pageRows: readonly { playerId: number }[];
  lines: readonly FantasyStatLine[];
};

const renderTrendLogs = (initialProps: HookProps) =>
  renderHook((props: HookProps) => useTrendLogs({ ...props, load }), { initialProps });

describe("useTrendLogs", () => {
  beforeEach(() => {
    load.mockReset();
    load.mockImplementation(() => Promise.resolve({ status: "ok", players: [] }));
  });

  it("requests nothing while disabled or for an empty page", () => {
    const { result, rerender } = renderTrendLogs({
      enabled: false,
      pageRows: rowsFor({ ids: [1, 2] }),
      lines,
    });
    rerender({ enabled: true, pageRows: [], lines });

    expect(result.current).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("loads the page's player set once and hands back its promise", () => {
    const { result } = renderTrendLogs({
      enabled: true,
      pageRows: rowsFor({ ids: [2, 1] }),
      lines,
    });

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith({ playerIds: [1, 2] });
    expect(result.current).toBeInstanceOf(Promise);
  });

  it("reuses the request when the same players come back in another order", () => {
    const { result, rerender } = renderTrendLogs({
      enabled: true,
      pageRows: rowsFor({ ids: [1, 2] }),
      lines,
    });
    const first = result.current;

    rerender({ enabled: true, pageRows: rowsFor({ ids: [2, 1] }), lines });

    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(first);
  });

  it("requests again for a new player set or a newly valued pool", () => {
    const { rerender } = renderTrendLogs({
      enabled: true,
      pageRows: rowsFor({ ids: [1, 2] }),
      lines,
    });

    rerender({ enabled: true, pageRows: rowsFor({ ids: [3] }), lines });
    rerender({ enabled: true, pageRows: rowsFor({ ids: [3] }), lines: [...lines] });

    expect(load).toHaveBeenCalledTimes(3);
    expect(load).toHaveBeenNthCalledWith(2, { playerIds: [3] });
    expect(load).toHaveBeenNthCalledWith(3, { playerIds: [3] });
  });
});
