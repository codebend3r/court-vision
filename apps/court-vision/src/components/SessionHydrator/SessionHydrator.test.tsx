import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { SessionHydrator } from "@/components/SessionHydrator/SessionHydrator";
import { useRosteredStore } from "@/lib/leagues/rosteredStore";
import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";
import { useWatchlistStore } from "@/lib/watchlist/store";

const league = ({ id, name }: { id: string; name: string }): LeagueSummary => ({
  id,
  name,
  slug: name.toLowerCase(),
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
});

beforeEach(() => {
  useWatchlistStore.setState({ playerIds: new Set<number>(), count: 0, lastError: null });
  useLeaguesStore.setState({ leagues: [], activeLeagueId: null });
  useRosteredStore.setState({ playerIds: new Set<number>() });
});

afterEach(cleanup);

describe("SessionHydrator", () => {
  it("seeds the watchlist, rostered and leagues stores and renders nothing", () => {
    const { container } = render(
      <SessionHydrator
        watchlistPlayerIds={[7, 9]}
        rosteredPlayerIds={[115, 237]}
        leagues={[league({ id: "a", name: "Alpha" })]}
        activeLeagueId="a"
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(useWatchlistStore.getState().playerIds.has(7)).toBe(true);
    expect(useWatchlistStore.getState().count).toBe(2);
    expect([...useRosteredStore.getState().playerIds]).toEqual([115, 237]);
    expect(useLeaguesStore.getState().leagues.map((entry) => entry.id)).toEqual(["a"]);
    expect(useLeaguesStore.getState().activeLeagueId).toBe("a");
  });

  it("re-seeds every store when the next navigation brings new data", () => {
    const { rerender } = render(
      <SessionHydrator
        watchlistPlayerIds={[7]}
        rosteredPlayerIds={[115]}
        leagues={[]}
        activeLeagueId={null}
      />,
    );
    rerender(
      <SessionHydrator
        watchlistPlayerIds={[]}
        rosteredPlayerIds={[237]}
        leagues={[league({ id: "b", name: "Beta" })]}
        activeLeagueId="b"
      />,
    );
    expect(useWatchlistStore.getState().count).toBe(0);
    expect([...useRosteredStore.getState().playerIds]).toEqual([237]);
    expect(useLeaguesStore.getState().activeLeagueId).toBe("b");
  });
});
