import { cleanup, render, screen } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import PlayerPage from "@/app/players/[playerId]/page";

const renderPage = async ({
  playerId,
  query = {},
}: {
  playerId: string;
  query?: Record<string, string>;
}) =>
  render(
    <ThemeProvider>
      {await PlayerPage({
        params: Promise.resolve({ playerId }),
        searchParams: Promise.resolve(query),
      })}
    </ThemeProvider>,
    { wrapper: withNuqsTestingAdapter({ searchParams: query }) },
  );

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

    await renderPage({ playerId: "3547238" });

    expect(screen.getByText("CJ Rivas")).toBeInTheDocument();
    // Header chip plus one per matchup cell
    expect(screen.getAllByTitle("Golden State Warriors")).toHaveLength(3);
    expect(screen.getAllByTitle("Los Angeles Lakers")).toHaveLength(2);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
    const fallback = screen.getByRole("img", { name: "CJ Rivas" });
    expect(fallback.tagName).not.toBe("IMG");
  });

  it("renders the NBA CDN headshot in the header when the player has an nbaPersonId", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({ ...player, nbaPersonId: 1630162 });
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([buildLog({ id: "log-1" })]);

    await renderPage({ playerId: "3547238" });

    const photo = screen.getByRole("img", { name: "CJ Rivas" });
    const src = decodeURIComponent(photo.getAttribute("src") ?? "");
    expect(src).toContain("/headshots/nba/latest/1040x760/1630162.png");
  });

  it("rejects for an unknown id", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([]);

    await expect(
      PlayerPage({
        params: Promise.resolve({ playerId: "999999" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow();
  });

  it("rejects for a non-numeric id without querying the database", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([]);

    await expect(
      PlayerPage({
        params: Promise.resolve({ playerId: "not-a-number" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow();

    expect(prisma.player.findUnique).not.toHaveBeenCalled();
  });

  it.each([["12abc"], ["99999999999"], ["0"], ["-5"]])(
    "rejects id %s without querying the database",
    async (playerId) => {
      vi.mocked(prisma.player.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([]);

      await expect(
        PlayerPage({
          params: Promise.resolve({ playerId }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow();

      expect(prisma.player.findUnique).not.toHaveBeenCalled();
    },
  );

  it("shows the empty state and no chips when the player has zero logs", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player);
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([]);

    render(
      await PlayerPage({
        params: Promise.resolve({ playerId: "3547238" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("No game logs for this player yet.")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders the stat filters alongside the chart", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player);
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([buildLog({ id: "log-1" })]);

    await renderPage({ playerId: "3547238" });

    expect(screen.getByRole("group", { name: "Stat mode" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Timeframe" })).toBeInTheDocument();
  });

  it("titles the counting panel from the mode param", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player);
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue([buildLog({ id: "log-1" })]);

    await renderPage({ playerId: "3547238", query: { mode: "totals" } });

    expect(screen.getByText("Accumulating totals")).toBeInTheDocument();
  });

  it("windows the series to the span param and keeps total games in the header", async () => {
    const logs = [...Array(15).keys()].map((index) =>
      buildLog({
        id: `log-${index + 1}`,
        gameId: `002250000${index + 1}`,
        gameDate: new Date(Date.UTC(2025, 9, 22 + index)),
      }),
    );
    vi.mocked(prisma.player.findUnique).mockResolvedValue(player);
    vi.mocked(prisma.playerGameLog.findMany).mockResolvedValue(logs);

    const { container } = await renderPage({ playerId: "3547238", query: { span: "10" } });

    // The x-axis restarts inside the window: highest game index is 10, not 15
    expect(screen.getByText("2025-26 · 15 games", { exact: false })).toBeInTheDocument();
    // A monotone line through N points draws N-1 curve segments, so the
    // windowed series must produce 9 "C" commands per line, not 14.
    const firstLinePath = container.querySelector(".recharts-line-curve");
    const curveSegments = (firstLinePath?.getAttribute("d") ?? "").match(/C/g) ?? [];
    expect(curveSegments).toHaveLength(9);
  });
});
