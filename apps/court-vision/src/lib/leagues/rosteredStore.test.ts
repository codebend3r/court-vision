import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, renderHook } from "@testing-library/react";

import { useIsRostered, useRosteredStore } from "@/lib/leagues/rosteredStore";

beforeEach(() => {
  useRosteredStore.setState({ playerIds: new Set<number>() });
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
