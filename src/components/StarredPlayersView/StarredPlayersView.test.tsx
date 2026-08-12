import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const getUser = vi.fn();
const getWatchlistPlayerIds = vi.fn();
const searchPlayers = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getUser }));
vi.mock("@/lib/watchlist/queries", () => ({ getWatchlistPlayerIds }));
vi.mock("@/lib/players/search", () => ({ searchPlayers }));

import { StarredPlayersView } from "@/components/StarredPlayersView/StarredPlayersView";
import { type PlayersSearchParams } from "@/lib/players/searchParams";

const params: PlayersSearchParams = {
  q: "",
  page: 1,
  size: 50,
  sort: "starredAt",
  dir: "desc",
  range: "all",
  mode: "average",
  minimums: true,
  tab: "starred",
};

const row = ({ id }: { id: number }) => ({
  id,
  firstName: `First${id}`,
  lastName: `Last${id}`,
  fullName: `First${id} Last${id}`,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
  stats: {
    gamesPlayed: 10,
    fgm: 50,
    fga: 100,
    fg3m: 20,
    fg3a: 50,
    ftm: 30,
    fta: 40,
    reb: 40,
    ast: 50,
    stl: 10,
    blk: 5,
    tov: 20,
    pts: 150,
  },
});

beforeEach(() => {
  getUser.mockReset();
  getWatchlistPlayerIds.mockReset();
  searchPlayers.mockReset();
  getUser.mockResolvedValue({ id: "user-1" });
});

afterEach(cleanup);

describe("StarredPlayersView", () => {
  it("prompts a signed-out visitor to sign in, without querying", async () => {
    getUser.mockResolvedValue(null);
    render(await StarredPlayersView({ params, showCounter: true }));
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fwatchlist",
    );
    expect(getWatchlistPlayerIds).not.toHaveBeenCalled();
  });

  it("shows an empty state pointing at the Players page", async () => {
    getWatchlistPlayerIds.mockResolvedValue([]);
    render(await StarredPlayersView({ params, showCounter: true }));
    expect(screen.getByText(/No starred players yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Players" })).toHaveAttribute("href", "/players");
    expect(searchPlayers).not.toHaveBeenCalled();
  });

  it("renders the counter against the cap when asked", async () => {
    getWatchlistPlayerIds.mockResolvedValue([7, 3]);
    searchPlayers.mockResolvedValue({ rows: [row({ id: 7 }), row({ id: 3 })], total: 2, page: 1 });
    render(await StarredPlayersView({ params, showCounter: true }));
    expect(screen.getByText("2 / 50 starred")).toBeInTheDocument();
    expect(screen.getByText("2 starred players")).toBeInTheDocument();
  });

  it("omits the counter on the tab", async () => {
    getWatchlistPlayerIds.mockResolvedValue([7]);
    searchPlayers.mockResolvedValue({ rows: [row({ id: 7 })], total: 1, page: 1 });
    render(await StarredPlayersView({ params, showCounter: false }));
    expect(screen.queryByText(/\/ 50 starred/)).toBeNull();
    expect(screen.getByText("1 starred player")).toBeInTheDocument();
  });

  it("restores star order when the query returns rows in another order", async () => {
    getWatchlistPlayerIds.mockResolvedValue([7, 3]);
    // searchPlayers has no notion of star time, so it hands back its own order.
    searchPlayers.mockResolvedValue({ rows: [row({ id: 3 }), row({ id: 7 })], total: 2, page: 1 });
    render(await StarredPlayersView({ params, showCounter: false }));
    const names = within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((tableRow) => within(tableRow).getAllByRole("link")[0]?.textContent ?? "");
    expect(names).toEqual(["First7 Last7", "First3 Last3"]);
  });

  it("passes the watchlist ids to the stats query", async () => {
    getWatchlistPlayerIds.mockResolvedValue([7, 3]);
    searchPlayers.mockResolvedValue({ rows: [], total: 0, page: 1 });
    render(await StarredPlayersView({ params, showCounter: false }));
    expect(searchPlayers).toHaveBeenCalledWith({ ...params, playerIds: [7, 3] });
  });
});
