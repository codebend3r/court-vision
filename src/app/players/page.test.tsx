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
  it("renders rows and a summary for a page of results", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({
      rows: [
        { id: 1, fullName: "Curry, Stephen", teamAbbr: "GSW", position: "G" },
        { id: 2, fullName: "Green, Draymond", teamAbbr: "GSW", position: "F" },
      ],
      total: 60,
      page: 2,
    });

    render(
      await PlayersPage({
        searchParams: Promise.resolve({ page: "2", size: "25" }),
      }),
    );

    const curryLink = screen.getByRole("link", { name: "Curry, Stephen" });
    expect(curryLink).toHaveAttribute("href", "/players/1");
    const greenLink = screen.getByRole("link", { name: "Green, Draymond" });
    expect(greenLink).toHaveAttribute("href", "/players/2");
    expect(screen.getByText("Showing 26–50 of 60")).toBeInTheDocument();
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
