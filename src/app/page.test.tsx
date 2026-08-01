import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const getProfile = vi.fn();
const getWatchlistPlayers = vi.fn();
const getWatchlistCount = vi.fn();
const getZTrendSeries = vi.fn();
const getGTrendSeries = vi.fn();
const getConferenceStandings = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));
vi.mock("@/lib/watchlist/queries", () => ({ getWatchlistPlayers, getWatchlistCount }));
vi.mock("@/lib/watchlist/trendLoader", () => ({ getZTrendSeries, getGTrendSeries }));
vi.mock("@/lib/standings/loader", () => ({ getConferenceStandings }));

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
  getGTrendSeries.mockReset();
  getConferenceStandings.mockReset();
  getWatchlistPlayers.mockResolvedValue([]);
  getWatchlistCount.mockResolvedValue(0);
  getZTrendSeries.mockResolvedValue([]);
  getGTrendSeries.mockResolvedValue([]);
  getConferenceStandings.mockResolvedValue(null);
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

// Next's redirect() throws an error whose digest encodes the destination
// ("NEXT_REDIRECT;push;/login;307;"); reading it is how a test observes where
// a server component sent the visitor.
const redirectTarget = (error: unknown): string =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  typeof error.digest === "string"
    ? error.digest
    : "";

describe("Home", () => {
  it("sends a signed-out visitor to the login form", async () => {
    getProfile.mockResolvedValue(null);

    const thrown = await Home().then(
      () => null,
      (error: unknown) => error,
    );

    expect(redirectTarget(thrown)).toContain("/login");
  });

  it("does not read the watchlist for a signed-out visitor", async () => {
    getProfile.mockResolvedValue(null);

    await Home().catch(() => null);

    expect(getWatchlistPlayers).not.toHaveBeenCalled();
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

  it("shows the conference standings ladders for a signed-in user", async () => {
    getProfile.mockResolvedValue({ username: "steve" });
    getConferenceStandings.mockResolvedValue({
      east: [
        {
          teamId: 21,
          abbreviation: "BOS",
          fullName: "Boston Celtics",
          rank: 1,
          wins: 50,
          losses: 15,
        },
      ],
      west: [
        {
          teamId: 14,
          abbreviation: "OKC",
          fullName: "Oklahoma City Thunder",
          rank: 1,
          wins: 55,
          losses: 10,
        },
      ],
    });

    await renderHome();

    expect(screen.getByRole("heading", { name: "Conference Standings" })).toBeInTheDocument();
    expect(screen.getByText("BOS")).toBeInTheDocument();
    expect(screen.getByText("OKC")).toBeInTheDocument();
  });

  it("still renders the standings panel when the API is unavailable", async () => {
    getProfile.mockResolvedValue({ username: "steve" });

    await renderHome();

    expect(screen.getByText(/Standings are unavailable/)).toBeInTheDocument();
  });

  it("charts the same players it lists", async () => {
    getProfile.mockResolvedValue({ username: "steve" });
    const players = [summary({ playerId: 1, fullName: "Jalen Brunson" })];
    getWatchlistPlayers.mockResolvedValue(players);
    getZTrendSeries.mockResolvedValue([{ playerId: 1, fullName: "Jalen Brunson", points: [] }]);
    getGTrendSeries.mockResolvedValue([{ playerId: 1, fullName: "Jalen Brunson", points: [] }]);

    await renderHome();

    expect(getZTrendSeries).toHaveBeenCalledWith({ players });
    expect(getGTrendSeries).toHaveBeenCalledWith({ players });
    expect(screen.getByRole("heading", { name: "Z-Score Trend" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "G-Score Trend" })).toBeInTheDocument();
  });
});
