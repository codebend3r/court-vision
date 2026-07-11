import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import PlayerPage from "./page";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: { findUnique: vi.fn() },
    playerGameLog: { findMany: vi.fn() },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

const buildLog = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "log-1",
  playerId: 3547238,
  gameId: "0022500001",
  gameDate: new Date("2025-10-22T00:00:00Z"),
  season: "2025-26",
  seasonType: "Regular Season",
  teamId: 1610612744,
  teamAbbr: "GSW",
  matchup: "GSW vs. LAL",
  opponentAbbr: "LAL",
  homeAway: "home",
  winLoss: "W",
  minutes: 34,
  fgm: 10,
  fga: 20,
  fg3m: 5,
  fg3a: 11,
  ftm: 4,
  fta: 4,
  oreb: 1,
  dreb: 4,
  reb: 5,
  ast: 8,
  stl: 2,
  blk: 0,
  tov: 3,
  pts: 29,
  plusMinus: 12,
  ...overrides,
});

const player = {
  id: 3547238,
  firstName: "CJ",
  lastName: "Rivas",
  fullName: "CJ Rivas",
  teamId: 1610612744,
  teamAbbr: "GSW",
  position: "G",
  jerseyNumber: "0",
  nbaPersonId: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

describe("PlayerPage", () => {
  it("renders the player name and chart chips for a known id with logs", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player);
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([
      buildLog({ id: "log-1" }),
      buildLog({ id: "log-2", gameId: "0022500002" }),
    ]);

    render(
      <ThemeProvider>
        {await PlayerPage({ params: Promise.resolve({ playerId: "3547238" }) })}
      </ThemeProvider>,
    );

    expect(screen.getByText("CJ Rivas")).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
    const fallback = screen.getByRole("img", { name: "CJ Rivas" });
    expect(fallback.tagName).not.toBe("IMG");
  });

  it("renders the NBA CDN headshot in the header when the player has an nbaPersonId", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({ ...player, nbaPersonId: 1630162 });
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([buildLog({ id: "log-1" })]);

    render(
      <ThemeProvider>
        {await PlayerPage({ params: Promise.resolve({ playerId: "3547238" }) })}
      </ThemeProvider>,
    );

    const photo = screen.getByRole("img", { name: "CJ Rivas" });
    const src = decodeURIComponent(photo.getAttribute("src") ?? "");
    expect(src).toContain("/headshots/nba/latest/1040x760/1630162.png");
  });

  it("rejects for an unknown id", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([]);

    await expect(PlayerPage({ params: Promise.resolve({ playerId: "999999" }) })).rejects.toThrow();
  });

  it("rejects for a non-numeric id without querying the database", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([]);

    await expect(
      PlayerPage({ params: Promise.resolve({ playerId: "not-a-number" }) }),
    ).rejects.toThrow();

    expect(prisma.player.findUnique).not.toHaveBeenCalled();
  });

  it("shows the empty state and no chips when the player has zero logs", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player);
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([]);

    render(await PlayerPage({ params: Promise.resolve({ playerId: "3547238" }) }));

    expect(screen.getByText("No game logs for this player yet.")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
