import { cleanup, render, screen, within } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlayersPage from "@/app/players/page";
import { searchPlayers, searchPlayersAdvanced } from "@/lib/players/searchCached";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { getFantasyPool } from "@/lib/valuation/loader";

// The page reads through the cached wrappers; mocking that module keeps the
// render off the real query (and off `unstable_cache`, which has no incremental
// cache to attach to under vitest).
vi.mock("@/lib/players/searchCached", () => ({
  searchPlayers: vi.fn(),
  searchPlayersAdvanced: vi.fn(),
}));

// The fantasy tab reads through its own cached loader; mocking keeps the
// render off prisma and `unstable_cache` for the same reason as above.
vi.mock("@/lib/valuation/loader", () => ({
  getFantasyPool: vi.fn(),
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
        searchParams: Promise.resolve({ page: "2", size: "25", sort: "firstName" }),
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
    expect(screen.getByRole("columnheader", { name: "3P%" })).toBeInTheDocument();
    expect(screen.getByText("25.0")).toBeInTheDocument();
    // 180 FGA and 110 3PA over 10 games
    expect(screen.getByText("18.0")).toBeInTheDocument();
    expect(screen.getByText("11.0")).toBeInTheDocument();
    expect(screen.getByText(".500")).toBeInTheDocument();
    // 40 of 110 from three
    expect(screen.getByText(".364")).toBeInTheDocument();
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

  it("marks the default points-descending sort active with no query params", async () => {
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

    // Landing view defaults to points, highest first.
    const ptsHeader = screen.getByRole("columnheader", { name: "PTS" });
    expect(ptsHeader).toHaveAttribute("aria-sort", "descending");
    const firstNameHeader = screen.getByRole("columnheader", { name: "First name" });
    expect(firstNameHeader).not.toHaveAttribute("aria-sort");

    // The active PTS header toggles direction; its default is omitted from the href.
    expect(screen.getByRole("link", { name: "PTS" })).toHaveAttribute("href", "/players?dir=asc");
    // An inactive header sorts by its own column.
    expect(screen.getByRole("link", { name: "First name" })).toHaveAttribute(
      "href",
      "/players?sort=firstName",
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
      "/players?q=curry&sort=firstName",
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

    // REB is not the default sort, so its header links to a reb sort.
    expect(screen.getByRole("link", { name: "REB" })).toHaveAttribute(
      "href",
      "/players?sort=reb&range=last5&mode=total",
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

describe("PlayersPage tabs", () => {
  it("renders the tab navigation with Regular Stats active by default", async () => {
    vi.mocked(searchPlayers).mockResolvedValue({ rows: [], total: 0, page: 1 });

    render(await PlayersPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /Regular Stats/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders the advanced stats table when tab=advanced", async () => {
    vi.mocked(searchPlayersAdvanced).mockResolvedValue({
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
            pie: 15.234,
            pace: 98.6,
            assistPercentage: 0.412,
            assistRatio: 30.1,
            assistToTurnover: 2.5,
            defensiveRating: 108.2,
            defensiveReboundPercentage: 0.1,
            effectiveFieldGoalPercentage: 0.588,
            netRating: 6.4,
            offensiveRating: 114.6,
            offensiveReboundPercentage: 0.02,
            reboundPercentage: 0.06,
            trueShootingPercentage: 0.634,
            turnoverRatio: 12.3,
            usagePercentage: 0.301,
            gamesWithData: 10,
          },
        },
      ],
      total: 1,
      page: 1,
    });

    render(await PlayersPage({ searchParams: Promise.resolve({ tab: "advanced" }) }));

    expect(screen.getByRole("link", { name: /Advanced Stats/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("columnheader", { name: "PIE" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "TS%" })).toBeInTheDocument();
    expect(screen.getByText("15.2")).toBeInTheDocument();
    expect(screen.getByText(".634")).toBeInTheDocument();
    expect(screen.queryByLabelText("Stat display")).not.toBeInTheDocument();
  });

  it("describes advanced headers via a tooltip and renders the legend", async () => {
    vi.mocked(searchPlayersAdvanced).mockResolvedValue({
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
            pie: 15.234,
            pace: 98.6,
            assistPercentage: 0.412,
            assistRatio: 30.1,
            assistToTurnover: 2.5,
            defensiveRating: 108.2,
            defensiveReboundPercentage: 0.1,
            effectiveFieldGoalPercentage: 0.588,
            netRating: 6.4,
            offensiveRating: 114.6,
            offensiveReboundPercentage: 0.02,
            reboundPercentage: 0.06,
            trueShootingPercentage: 0.634,
            turnoverRatio: 12.3,
            usagePercentage: 0.301,
            gamesWithData: 10,
          },
        },
      ],
      total: 1,
      page: 1,
    });

    render(await PlayersPage({ searchParams: Promise.resolve({ tab: "advanced" }) }));

    const tsHeader = screen.getByRole("columnheader", { name: "TS%" });
    const tsLink = within(tsHeader).getByRole("link");
    expect(tsLink).toHaveAttribute("aria-describedby", "stat-tip-trueShootingPercentage");
    expect(document.getElementById("stat-tip-trueShootingPercentage")).toHaveTextContent(
      "PTS ÷ (2 × (FGA + 0.44 × FTA))",
    );
    expect(screen.getByText("What do these stats mean?")).toBeInTheDocument();
  });

  it("renders one sortable column per valuation method from the pool loader", async () => {
    vi.mocked(getFantasyPool).mockResolvedValue([
      makeStatLine({ playerId: 1, pts: 900 }),
      makeStatLine({ playerId: 2, pts: 500 }),
    ]);

    render(await PlayersPage({ searchParams: Promise.resolve({ tab: "fantasy" }) }), {
      wrapper: withNuqsTestingAdapter({ searchParams: "?tab=fantasy" }),
    });

    expect(screen.getByRole("link", { name: /Fantasy Value/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(getFantasyPool).toHaveBeenCalledWith({ range: "all" });
    expect(screen.getByRole("columnheader", { name: /Z-Score/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /G-Score/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Points/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "VORP" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /SGP/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Punt PTS" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search players")).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    expect(searchPlayers).not.toHaveBeenCalled();
  });

  it("passes the range param through to the fantasy pool loader", async () => {
    vi.mocked(getFantasyPool).mockResolvedValue([]);

    render(
      await PlayersPage({ searchParams: Promise.resolve({ tab: "fantasy", range: "last10" }) }),
      {
        wrapper: withNuqsTestingAdapter({ searchParams: "?tab=fantasy&range=last10" }),
      },
    );

    expect(getFantasyPool).toHaveBeenCalledWith({ range: "last10" });
    expect(screen.getByText(/No players yet/)).toBeInTheDocument();
  });
});
