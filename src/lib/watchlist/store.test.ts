import { beforeEach, describe, expect, it } from "bun:test";

import { useWatchlistStore } from "@/lib/watchlist/store";

beforeEach(() => {
  useWatchlistStore.setState({ playerIds: new Set<number>(), count: 0, lastError: null });
});

describe("useWatchlistStore", () => {
  it("hydrates ids and count together", () => {
    useWatchlistStore.getState().hydrate({ playerIds: [3, 7] });
    const state = useWatchlistStore.getState();
    expect([...state.playerIds]).toEqual([3, 7]);
    expect(state.count).toBe(2);
  });

  it("adds and removes without mutating the previous set", () => {
    const { hydrate, add, remove } = useWatchlistStore.getState();
    hydrate({ playerIds: [3] });
    const before = useWatchlistStore.getState().playerIds;
    add({ playerId: 7 });
    expect([...before]).toEqual([3]);
    expect(useWatchlistStore.getState().playerIds.has(7)).toBe(true);
    expect(useWatchlistStore.getState().count).toBe(2);
    remove({ playerId: 3 });
    expect(useWatchlistStore.getState().playerIds.has(3)).toBe(false);
    expect(useWatchlistStore.getState().count).toBe(1);
  });

  it("does not double-count a re-added player", () => {
    const { add } = useWatchlistStore.getState();
    add({ playerId: 7 });
    add({ playerId: 7 });
    expect(useWatchlistStore.getState().count).toBe(1);
  });

  it("holds the last error until cleared", () => {
    useWatchlistStore.getState().setError({ error: "limit" });
    expect(useWatchlistStore.getState().lastError).toBe("limit");
    useWatchlistStore.getState().clearError();
    expect(useWatchlistStore.getState().lastError).toBeNull();
  });

  it("takes an authoritative count from the server", () => {
    useWatchlistStore.getState().setCount({ count: 42 });
    expect(useWatchlistStore.getState().count).toBe(42);
  });
});
