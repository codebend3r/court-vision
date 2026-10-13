import { beforeEach, describe, expect, it, vi } from "bun:test";

import * as persist from "@/lib/stats/persist";

import * as endpoints from "@/lib/balldontlie/endpoints";
import { BdlPlayer } from "@/lib/balldontlie/schemas";
import { syncPlayers } from "@/lib/balldontlie/sync-players";

const rookie: BdlPlayer = {
  id: 1057262817,
  first_name: "AJ",
  last_name: "Dybantsa",
  position: "F",
  jersey_number: "0",
  height: "6-9",
  weight: "210",
  college: "BYU",
  country: "USA",
  draft_year: 2026,
  draft_round: 1,
  draft_number: 1,
  team: { id: 30, abbreviation: "WAS" },
};

const veteran: BdlPlayer = {
  ...rookie,
  id: 115,
  first_name: "Stephen",
  last_name: "Curry",
  draft_year: 2009,
  draft_number: 7,
  team: { id: 10, abbreviation: "GSW" },
};

describe("syncPlayers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("upserts the active list with current teams, then flags exactly those players", async () => {
    vi.spyOn(endpoints, "fetchActivePlayers").mockResolvedValue([rookie, veteran]);
    const upsertPlayers = vi.spyOn(persist, "upsertPlayers").mockResolvedValue(2);
    const markActiveRoster = vi.spyOn(persist, "markActiveRoster").mockResolvedValue(2);

    const summary = await syncPlayers();

    expect(summary).toEqual({ fetched: 2, upserted: 2, active: 2 });
    expect(upsertPlayers).toHaveBeenCalledWith({
      players: [
        expect.objectContaining({ id: 1057262817, teamAbbr: "WAS", draftYear: 2026 }),
        expect.objectContaining({ id: 115, teamAbbr: "GSW" }),
      ],
    });
    expect(markActiveRoster).toHaveBeenCalledWith({ playerIds: [1057262817, 115] });
  });

  it("writes players before flagging them, so a rookie's row exists to flag", async () => {
    vi.spyOn(endpoints, "fetchActivePlayers").mockResolvedValue([rookie]);
    const order: string[] = [];
    vi.spyOn(persist, "upsertPlayers").mockImplementation(async () => {
      order.push("upsert");
      return 1;
    });
    vi.spyOn(persist, "markActiveRoster").mockImplementation(async () => {
      order.push("mark");
      return 1;
    });

    await syncPlayers();

    expect(order).toEqual(["upsert", "mark"]);
  });

  it("hands its logger to the paginator so each page of the active list is logged", async () => {
    const fetchActivePlayers = vi
      .spyOn(endpoints, "fetchActivePlayers")
      .mockResolvedValue([rookie]);
    vi.spyOn(persist, "upsertPlayers").mockResolvedValue(1);
    vi.spyOn(persist, "markActiveRoster").mockResolvedValue(1);
    const logger = vi.fn();

    await syncPlayers({ logger });

    expect(fetchActivePlayers).toHaveBeenCalledWith({ deps: expect.objectContaining({ logger }) });
  });
});
