import { beforeEach, describe, expect, it, vi } from "bun:test";

import { type SetActiveLeagueResult } from "@/lib/leagues/types";

const setActiveLeague = vi.fn<(args: { leagueId: string }) => Promise<SetActiveLeagueResult>>();

vi.mock("@/lib/leagues/actions", () => ({ setActiveLeague }));

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
  updatedAt: "2026-07-31T00:00:00.000Z",
});

beforeEach(() => {
  setActiveLeague.mockReset().mockResolvedValue({ status: "ok" });
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
    expect(useLeaguesStore.getState().leagues[0]?.name ?? null).toBe("Renamed");
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

describe("switchActiveLeague", () => {
  beforeEach(() => {
    useLeaguesStore.getState().hydrate({
      leagues: [league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })],
      activeLeagueId: "a",
    });
  });

  it("flips the active league before the action answers, then keeps it", async () => {
    const switching = useLeaguesStore.getState().switchActiveLeague({ leagueId: "b" });
    expect(useLeaguesStore.getState().activeLeagueId).toBe("b");
    expect(await switching).toEqual({ status: "ok" });
    expect(setActiveLeague).toHaveBeenCalledWith({ leagueId: "b" });
    expect(useLeaguesStore.getState().activeLeagueId).toBe("b");
  });

  it("puts the previous league back when the action fails", async () => {
    setActiveLeague.mockResolvedValue({ status: "error" });
    const result = await useLeaguesStore.getState().switchActiveLeague({ leagueId: "b" });
    expect(result).toEqual({ status: "error" });
    expect(useLeaguesStore.getState().activeLeagueId).toBe("a");
  });

  it("puts the previous league back when the action throws", async () => {
    setActiveLeague.mockRejectedValue(new Error("network down"));
    const result = await useLeaguesStore.getState().switchActiveLeague({ leagueId: "b" });
    expect(result).toEqual({ status: "error" });
    expect(useLeaguesStore.getState().activeLeagueId).toBe("a");
  });

  it("leaves a later switch in place when an earlier one fails", async () => {
    const failing = Promise.withResolvers<SetActiveLeagueResult>();
    setActiveLeague.mockReturnValueOnce(failing.promise);
    const first = useLeaguesStore.getState().switchActiveLeague({ leagueId: "b" });
    useLeaguesStore.getState().setActive({ leagueId: "c" });
    failing.resolve({ status: "error" });
    expect(await first).toEqual({ status: "error" });
    expect(useLeaguesStore.getState().activeLeagueId).toBe("c");
  });
});
