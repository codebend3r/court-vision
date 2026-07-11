import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchPlayers } from "@/lib/players/search";

import PlayersPage from "./page";

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
    expect(screen.getByText("Showing 26–50 of 60")).toBeInTheDocument();
  });

  it("renders sortable name headers with the default first name ascending sort", async () => {
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
    expect(firstNameHeader).toHaveAttribute("aria-sort", "ascending");
    const lastNameHeader = screen.getByRole("columnheader", { name: "Last name" });
    expect(lastNameHeader).not.toHaveAttribute("aria-sort");

    expect(screen.getByRole("link", { name: "First name" })).toHaveAttribute(
      "href",
      "/players?dir=desc",
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
      "/players?q=curry&sort=lastName",
    );
    expect(screen.getByRole("link", { name: "First name" })).toHaveAttribute(
      "href",
      "/players?q=curry",
    );
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
