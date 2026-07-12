import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchPlayers } from "@/lib/players/search";

import PlayersPage from "@/app/players/page";

vi.mock("@/lib/players/search", () => ({
  searchPlayers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("PlayersPage", () => {
  it("renders first and last name link columns and a summary for a page of results", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({
      rows: [
        {
          id: 1,
          firstName: "Stephen",
          lastName: "Curry",
          fullName: "Stephen Curry",
          teamAbbr: "GSW",
          position: "G",
          nbaPersonId: null,
          seasonStats: [
            {
              gamesPlayed: 10,
              pts: 250,
              reb: 50,
              ast: 60,
              stl: 15,
              blk: 5,
              fg3m: 40,
              fg3a: 110,
              fgm: 90,
              fga: 180,
              ftm: 30,
              fta: 40,
              tov: 20,
            },
          ],
        },
        {
          id: 2,
          firstName: "Draymond",
          lastName: "Green",
          fullName: "Draymond Green",
          teamAbbr: "GSW",
          position: "F",
          nbaPersonId: null,
        },
      ],
      total: 60,
      page: 2,
    });

    render(
      await PlayersPage({
        searchParams: Promise.resolve({ page: "2", size: "25" }),
      }),
    );

    expect(screen.getByRole("link", { name: "Stephen" })).toHaveAttribute("href", "/players/1");
    expect(screen.getByRole("link", { name: "Curry" })).toHaveAttribute("href", "/players/1");
    expect(screen.getByRole("link", { name: "Draymond" })).toHaveAttribute("href", "/players/2");
    expect(screen.getByRole("link", { name: "Green" })).toHaveAttribute("href", "/players/2");
    expect(screen.getAllByTitle("Golden State Warriors")).toHaveLength(2);
    expect(screen.getByText("Showing 26–50 of 60")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "PTS" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "GP" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "FGM" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "FGA" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "3PA" })).toBeInTheDocument();
    expect(screen.getByText("25.0")).toBeInTheDocument();
    // 180 FGA and 110 3PA over 10 games
    expect(screen.getByText("18.0")).toBeInTheDocument();
    expect(screen.getByText("11.0")).toBeInTheDocument();
    expect(screen.getByText(".500")).toBeInTheDocument();
    expect(screen.getByText(".750")).toBeInTheDocument();
    // name sort: no rank column
    expect(screen.queryByRole("columnheader", { name: "#" })).not.toBeInTheDocument();
  });

  it("shows a rank column when sorting by a stat, offset by the page", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({
      rows: [
        {
          id: 1,
          firstName: "Stephen",
          lastName: "Curry",
          fullName: "Stephen Curry",
          teamAbbr: "GSW",
          position: "G",
          nbaPersonId: null,
        },
        {
          id: 2,
          firstName: "Draymond",
          lastName: "Green",
          fullName: "Draymond Green",
          teamAbbr: "GSW",
          position: "F",
          nbaPersonId: null,
        },
      ],
      total: 60,
      page: 2,
    });

    render(
      await PlayersPage({
        searchParams: Promise.resolve({ page: "2", size: "25", sort: "pts" }),
      }),
    );

    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();
    // page 2 of 25-per-page: ranks continue from 26
    expect(screen.getByText("26")).toBeInTheDocument();
    expect(screen.getByText("27")).toBeInTheDocument();
  });

  it("renders sortable name headers with the default first name descending sort", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({
      rows: [
        {
          id: 1,
          firstName: "Stephen",
          lastName: "Curry",
          fullName: "Stephen Curry",
          teamAbbr: "GSW",
          position: "G",
          nbaPersonId: null,
        },
      ],
      total: 1,
      page: 1,
    });

    render(await PlayersPage({ searchParams: Promise.resolve({}) }));

    const firstNameHeader = screen.getByRole("columnheader", { name: "First name" });
    expect(firstNameHeader).toHaveAttribute("aria-sort", "descending");
    const lastNameHeader = screen.getByRole("columnheader", { name: "Last name" });
    expect(lastNameHeader).not.toHaveAttribute("aria-sort");

    expect(screen.getByRole("link", { name: "First name" })).toHaveAttribute(
      "href",
      "/players?dir=asc",
    );
    expect(screen.getByRole("link", { name: "Last name" })).toHaveAttribute(
      "href",
      "/players?sort=lastName",
    );
  });

  it("toggles the active header link and marks descending last name sort", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({
      rows: [
        {
          id: 1,
          firstName: "Stephen",
          lastName: "Curry",
          fullName: "Stephen Curry",
          teamAbbr: "GSW",
          position: "G",
          nbaPersonId: null,
        },
      ],
      total: 1,
      page: 1,
    });

    render(
      await PlayersPage({
        searchParams: Promise.resolve({ sort: "lastName", dir: "desc", q: "curry" }),
      }),
    );

    expect(searchPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "lastName", dir: "desc", q: "curry" }),
    );

    const lastNameHeader = screen.getByRole("columnheader", { name: "Last name" });
    expect(lastNameHeader).toHaveAttribute("aria-sort", "descending");

    expect(screen.getByRole("link", { name: "Last name" })).toHaveAttribute(
      "href",
      "/players?q=curry&sort=lastName&dir=asc",
    );
    expect(screen.getByRole("link", { name: "First name" })).toHaveAttribute(
      "href",
      "/players?q=curry",
    );
  });

  it("makes stat headers sortable and renders totals when selected", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({
      rows: [
        {
          id: 1,
          firstName: "Stephen",
          lastName: "Curry",
          fullName: "Stephen Curry",
          teamAbbr: "GSW",
          position: "G",
          nbaPersonId: null,
          stats: {
            gamesPlayed: 5,
            pts: 140,
            reb: 25,
            ast: 30,
            stl: 5,
            blk: 2,
            fg3m: 20,
            fg3a: 55,
            fgm: 50,
            fga: 100,
            ftm: 20,
            fta: 25,
            tov: 10,
          },
        },
      ],
      total: 1,
      page: 1,
    });

    render(await PlayersPage({ searchParams: Promise.resolve({ range: "last5", mode: "total" }) }));

    expect(screen.getByRole("link", { name: "PTS" })).toHaveAttribute(
      "href",
      "/players?sort=pts&range=last5&mode=total",
    );
    expect(screen.getByText("140")).toBeInTheDocument();
  });

  it("shows a headshot image for a row with an nbaPersonId and initials for a row without", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({
      rows: [
        {
          id: 1,
          firstName: "Stephen",
          lastName: "Curry",
          fullName: "Stephen Curry",
          teamAbbr: "GSW",
          position: "G",
          nbaPersonId: 201939,
        },
        {
          id: 2,
          firstName: "Draymond",
          lastName: "Green",
          fullName: "Draymond Green",
          teamAbbr: "GSW",
          position: "F",
          nbaPersonId: null,
        },
      ],
      total: 2,
      page: 1,
    });

    render(await PlayersPage({ searchParams: Promise.resolve({}) }));

    const photo = screen.getByRole("img", { name: "Stephen Curry" });
    const src = decodeURIComponent(photo.getAttribute("src") ?? "");
    expect(src).toContain("/headshots/nba/latest/1040x760/201939.png");

    const fallback = screen.getByRole("img", { name: "Draymond Green" });
    expect(fallback.tagName).not.toBe("IMG");
    expect(fallback).toHaveTextContent("DG");
  });

  it("shows a not-found message when there are zero matches for a query", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({ rows: [], total: 0, page: 1 });

    render(await PlayersPage({ searchParams: Promise.resolve({ q: "zz" }) }));

    expect(screen.getByText('No players match "zz".')).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a not-synced message when there are zero players and no query", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({ rows: [], total: 0, page: 1 });

    render(await PlayersPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByText("No players yet — the season data hasn't been synced."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("normalizes array search params by taking the first value", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({ rows: [], total: 0, page: 1 });

    render(await PlayersPage({ searchParams: Promise.resolve({ q: ["curry", "x"] }) }));

    expect(searchPlayers).toHaveBeenCalledWith(expect.objectContaining({ q: "curry" }));
  });
});
