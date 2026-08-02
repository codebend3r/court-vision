import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { buildTeamStats } from "@/lib/teams/stats";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import TeamsPage from "@/app/teams/page";

const getTeamStats = vi.fn();

vi.mock("@/lib/teams/loader", () => ({
  getTeamStats,
}));

type SearchParams = Record<string, string | string[] | undefined>;

const renderPage = async (searchParams: SearchParams) =>
  render(
    <ThemeProvider>
      {await TeamsPage({ searchParams: Promise.resolve(searchParams) })}
    </ThemeProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  getTeamStats.mockResolvedValue({
    season: "2024-25",
    results: [],
    stats: buildTeamStats({
      results: [
        {
          teamAbbr: "TOR",
          gameId: "g1",
          teamScore: 120,
          opponentScore: 100,
          winLoss: "W",
          gameDate: new Date("2024-11-01"),
        },
        {
          teamAbbr: "BOS",
          gameId: "g1",
          teamScore: 100,
          opponentScore: 120,
          winLoss: "L",
          gameDate: new Date("2024-11-01"),
        },
      ],
      totals: [
        {
          teamAbbr: "TOR",
          pts: 120,
          reb: 40,
          ast: 25,
          stl: 8,
          blk: 5,
          tov: 12,
          fg3m: 15,
          fgm: 45,
          fga: 90,
          ftm: 15,
          fta: 20,
        },
      ],
    }),
  });
});

afterEach(cleanup);

describe("TeamsPage", () => {
  it("renders all six divisions with every team linked by slug", async () => {
    await renderPage({});

    expect(screen.getByRole("heading", { name: "Atlantic (East)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Southwest (West)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Toronto Raptors/ })).toHaveAttribute(
      "href",
      "/team?is=raptors",
    );
    expect(screen.getByRole("link", { name: /Portland Trail Blazers/ })).toHaveAttribute(
      "href",
      "/team?is=trail-blazers",
    );
    expect(screen.getAllByRole("link", { name: /—/ }).length).toBeGreaterThan(0); // teams without data
    expect(screen.getByText("2024-25 regular season")).toBeInTheDocument();
  });

  it("groups by conference when the view param says so", async () => {
    await renderPage({ view: "conference" });

    expect(screen.getByRole("heading", { name: "Eastern Conference" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Western Conference" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Atlantic (East)" })).not.toBeInTheDocument();
  });

  it("renders one flat standings list in league view, best record first", async () => {
    await renderPage({ view: "league" });

    expect(screen.getByRole("heading", { name: "League" })).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /1–0|0–1|—/ });
    expect(links[0]).toHaveTextContent("Toronto Raptors"); // only win in the fixture
  });

  it("marks the active view", async () => {
    await renderPage({ view: "league" });

    expect(screen.getByRole("link", { name: "League" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Division" })).not.toHaveAttribute("aria-current");
  });

  it("renders a cumulative-wins chart per standings block when results exist", async () => {
    // One team per division, so every division/conference/league block has
    // at least one result and therefore a non-empty chart.
    const resultsByDivisionTeam = ["BOS", "CHI", "ATL", "DEN", "GSW", "DAL"].map((teamAbbr) => ({
      teamAbbr,
      gameId: `g-${teamAbbr}`,
      teamScore: 100,
      opponentScore: 90,
      winLoss: "W",
      gameDate: new Date("2024-11-01"),
    }));
    getTeamStats.mockResolvedValue({
      season: "2024-25",
      results: resultsByDivisionTeam,
      stats: buildTeamStats({ results: resultsByDivisionTeam, totals: [] }),
    });

    await renderPage({});
    expect(screen.getAllByRole("img")).toHaveLength(6);
    cleanup();

    await renderPage({ view: "conference" });
    expect(screen.getAllByRole("img")).toHaveLength(2);
    cleanup();

    await renderPage({ view: "league" });
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("renders no chart frame when the season has no results", async () => {
    await renderPage({});

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
