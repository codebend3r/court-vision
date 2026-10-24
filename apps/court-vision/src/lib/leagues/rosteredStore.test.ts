import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, renderHook } from "@testing-library/react";

import { useIsRostered, useOwnership, useRosteredStore } from "@/lib/leagues/rosteredStore";

beforeEach(() => {
  useRosteredStore.setState({ playerIds: new Set<number>(), owners: null });
});

afterEach(cleanup);

describe("useRosteredStore", () => {
  it("replaces the rostered set on every hydrate", () => {
    const { hydrate } = useRosteredStore.getState();
    hydrate({ playerIds: [3, 7] });
    hydrate({ playerIds: [7, 9] });
    expect([...useRosteredStore.getState().playerIds]).toEqual([7, 9]);
  });
});

describe("useIsRostered", () => {
  it("reports whether a player is on one of your teams", () => {
    useRosteredStore.getState().hydrate({ playerIds: [7] });

    expect(renderHook(() => useIsRostered({ playerId: 7 })).result.current).toBe(true);
    expect(renderHook(() => useIsRostered({ playerId: 3 })).result.current).toBe(false);
  });
});

describe("useOwnership", () => {
  const owners = [
    { playerId: 1, teamName: "Softchoice", isMine: true },
    { playerId: 2, teamName: "Rivals", isMine: false },
  ];

  it("is unknown until the league's owners are hydrated", () => {
    useRosteredStore.getState().hydrate({ playerIds: [1] });

    expect(renderHook(() => useOwnership({ playerId: 1 })).result.current).toBeNull();
  });

  it("names the holder, and calls an unheld player a free agent", () => {
    useRosteredStore.getState().hydrate({ playerIds: [1], owners });

    expect(renderHook(() => useOwnership({ playerId: 1 })).result.current).toEqual({
      status: "mine",
      teamName: "Softchoice",
    });
    expect(renderHook(() => useOwnership({ playerId: 2 })).result.current).toEqual({
      status: "other",
      teamName: "Rivals",
    });
    expect(renderHook(() => useOwnership({ playerId: 3 })).result.current).toEqual({
      status: "free",
    });
  });
});
