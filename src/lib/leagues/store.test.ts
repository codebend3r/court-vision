import { describe, expect, it, beforeEach } from "bun:test";

import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";

const league = ({ id, name }: { id: string; name: string }): LeagueSummary => ({
  id,
  name,
  slug: name.toLowerCase(),
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
  createdAt: "2026-07-31T00:00:00.000Z",
});

beforeEach(() => {
  useLeaguesStore.setState({ leagues: [], activeLeagueId: null });
});

describe("useLeaguesStore", () => {
  it("hydrates leagues and the active id", () => {
    useLeaguesStore
      .getState()
      .hydrate({ leagues: [league({ id: "a", name: "Alpha" })], activeLeagueId: "a" });
    expect(useLeaguesStore.getState().leagues).toHaveLength(1);
    expect(useLeaguesStore.getState().activeLeagueId).toBe("a");
  });

  it("upsert replaces by id and appends when new", () => {
    const alpha = league({ id: "a", name: "Alpha" });
    useLeaguesStore.getState().hydrate({ leagues: [alpha], activeLeagueId: "a" });
    useLeaguesStore.getState().upsert({ league: { ...alpha, name: "Renamed" } });
    expect(useLeaguesStore.getState().leagues[0]?.name).toBe("Renamed");
    useLeaguesStore.getState().upsert({ league: league({ id: "b", name: "Beta" }) });
    expect(useLeaguesStore.getState().leagues).toHaveLength(2);
  });

  it("remove drops the league and clears a dangling active id", () => {
    useLeaguesStore
      .getState()
      .hydrate({ leagues: [league({ id: "a", name: "Alpha" })], activeLeagueId: "a" });
    useLeaguesStore.getState().remove({ leagueId: "a" });
    expect(useLeaguesStore.getState().leagues).toHaveLength(0);
    expect(useLeaguesStore.getState().activeLeagueId).toBe(null);
  });
});
