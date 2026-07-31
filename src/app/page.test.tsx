import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const getProfile = vi.fn();
const getWatchlistPlayers = vi.fn();
const getWatchlistCount = vi.fn();
const getZTrendSeries = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));
vi.mock("@/lib/watchlist/queries", () => ({ getWatchlistPlayers, getWatchlistCount }));
vi.mock("@/lib/watchlist/zTrendLoader", () => ({ getZTrendSeries }));

import Home from "@/app/page";
import { useFantasyTeamsStore } from "@/lib/fantasyTeams/store";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

// The chart is a client component that reads the theme; in the app that comes
// from the root layout, so the test supplies the same wrapper.
const renderHome = async () => render(<ThemeProvider>{await Home()}</ThemeProvider>);

afterEach(cleanup);

beforeEach(() => {
  getProfile.mockReset();
  getWatchlistPlayers.mockReset();
  getWatchlistCount.mockReset();
  getZTrendSeries.mockReset();
  getWatchlistPlayers.mockResolvedValue([]);
  getWatchlistCount.mockResolvedValue(0);
  getZTrendSeries.mockResolvedValue([]);
  useFantasyTeamsStore.setState({ teams: [] });
});

const summary = ({ playerId, fullName }: { playerId: number; fullName: string }) => ({
  playerId,
  fullName,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
  starredAt: "2026-07-30T12:00:00.000Z",
});

describe("Home", () => {
  it("shows sign-in prompts for Your Team and Starred Players when signed out", async () => {
    getProfile.mockResolvedValue(null);

    await renderHome();

    expect(screen.getByRole("heading", { name: "Your Team" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Starred Players" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Sign in" })).toHaveLength(2);
  });

  it("does not read the watchlist for a signed-out visitor", async () => {
    getProfile.mockResolvedValue(null);

    await renderHome();

    expect(getWatchlistPlayers).not.toHaveBeenCalled();
  });

  it("still shows the stat trends placeholder when signed out", async () => {
    getProfile.mockResolvedValue(null);

    await renderHome();

    expect(screen.getByRole("heading", { name: "Stat Trends to Watch" })).toBeInTheDocument();
  });

  it("lists the most recently starred players with a link to the full list", async () => {
    getProfile.mockResolvedValue({ username: "steve" });
    getWatchlistPlayers.mockResolvedValue([
      summary({ playerId: 1, fullName: "Jalen Brunson" }),
      summary({ playerId: 2, fullName: "Karl-Anthony Towns" }),
    ]);
    getWatchlistCount.mockResolvedValue(12);

    await renderHome();

    expect(screen.getByRole("link", { name: "Jalen Brunson" })).toHaveAttribute(
      "href",
      "/players/1",
    );
    expect(screen.getByRole("link", { name: "View all (12)" })).toHaveAttribute(
      "href",
      "/watchlist",
    );
  });

  it("asks only for the homepage's five players", async () => {
    getProfile.mockResolvedValue({ username: "steve" });

    await renderHome();

    expect(getWatchlistPlayers).toHaveBeenCalledWith({ limit: 5 });
  });

  it("shows the empty watchlist state when the user has starred nobody", async () => {
    getProfile.mockResolvedValue({ username: "steve" });

    await renderHome();

    expect(screen.getByText(/aren't watching any players yet/)).toBeInTheDocument();
  });

  it("prompts a signed-in user with no fantasy team to create one", async () => {
    getProfile.mockResolvedValue({ username: "steve" });

    await renderHome();

    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "create your first team" })).toHaveAttribute(
      "href",
      "/my-teams/create",
    );
  });

  it("charts the same players it lists", async () => {
    getProfile.mockResolvedValue({ username: "steve" });
    const players = [summary({ playerId: 1, fullName: "Jalen Brunson" })];
    getWatchlistPlayers.mockResolvedValue(players);
    getZTrendSeries.mockResolvedValue([{ playerId: 1, fullName: "Jalen Brunson", points: [] }]);

    await renderHome();

    expect(getZTrendSeries).toHaveBeenCalledWith({ players });
    expect(screen.getByRole("heading", { name: "Z-Score Trend" })).toBeInTheDocument();
  });
});
