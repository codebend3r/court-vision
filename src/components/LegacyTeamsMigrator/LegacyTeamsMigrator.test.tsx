import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const importLegacyTeamsMock = vi.fn();

vi.mock("@/lib/leagues/teamActions", () => ({
  importLegacyTeams: (args: { teams: unknown }) => importLegacyTeamsMock(args),
}));

import { LegacyTeamsMigrator } from "@/components/LegacyTeamsMigrator/LegacyTeamsMigrator";

const LEGACY_KEY = "court-vision-fantasy-teams";

const player = {
  playerId: 7,
  firstName: "Kevin",
  lastName: "Durant",
  fullName: "Kevin Durant",
  teamAbbr: "HOU",
  position: "F",
  nbaPersonId: 201142,
};

const legacyPayload = {
  state: {
    teams: [
      {
        id: "team-1",
        name: "Bench Mob",
        createdAt: "2026-07-23T00:00:00.000Z",
        slots: [
          { id: "PG-1", type: "PG", player },
          { id: "UTIL-1", type: "UTIL", player: null },
        ],
      },
    ],
  },
  version: 0,
};

const parsedTeams = [
  {
    id: "team-1",
    name: "Bench Mob",
    // parseLegacyTeamsPayload always assigns "" — no DB row exists yet to
    // carry a real slug from.
    slug: "",
    createdAt: "2026-07-23T00:00:00.000Z",
    slots: [
      { id: "PG-1", type: "PG", player },
      { id: "UTIL-1", type: "UTIL", player: null },
    ],
  },
];

beforeEach(() => {
  importLegacyTeamsMock.mockReset();
  window.localStorage.clear();
});

afterEach(cleanup);

describe("LegacyTeamsMigrator", () => {
  it("imports the parsed teams and clears the key on ok", async () => {
    importLegacyTeamsMock.mockResolvedValue({ status: "ok" });
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyPayload));

    render(<LegacyTeamsMigrator />);

    await waitFor(() => expect(importLegacyTeamsMock).toHaveBeenCalledWith({ teams: parsedTeams }));
    await waitFor(() => expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull());
  });

  it("clears the key when the import is skipped", async () => {
    importLegacyTeamsMock.mockResolvedValue({ status: "skipped" });
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyPayload));

    render(<LegacyTeamsMigrator />);

    await waitFor(() => expect(importLegacyTeamsMock).toHaveBeenCalled());
    await waitFor(() => expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull());
  });

  it("keeps the key when the import errors, so it retries next visit", async () => {
    importLegacyTeamsMock.mockResolvedValue({ status: "error" });
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyPayload));

    render(<LegacyTeamsMigrator />);

    await waitFor(() => expect(importLegacyTeamsMock).toHaveBeenCalled());
    expect(window.localStorage.getItem(LEGACY_KEY)).toBe(JSON.stringify(legacyPayload));
  });

  it("does nothing when there is no legacy key", () => {
    render(<LegacyTeamsMigrator />);
    expect(importLegacyTeamsMock).not.toHaveBeenCalled();
  });

  it("removes an unparseable payload without calling the action", async () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ state: { teams: "no" } }));

    render(<LegacyTeamsMigrator />);

    await waitFor(() => expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull());
    expect(importLegacyTeamsMock).not.toHaveBeenCalled();
  });
});
