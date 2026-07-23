import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamsPage from "@/app/teams/page";
import { getTeamStats } from "@/lib/teams/loader";
import { buildTeamStats } from "@/lib/teams/stats";

vi.mock("@/lib/teams/loader", () => ({
  getTeamStats: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTeamStats).mockResolvedValue({
    season: "2024-25",
    stats: buildTeamStats({
      results: [
        { teamAbbr: "TOR", gameId: "g1", teamScore: 120, opponentScore: 100, winLoss: "W" },
        { teamAbbr: "BOS", gameId: "g1", teamScore: 100, opponentScore: 120, winLoss: "L" },
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
    render(await TeamsPage({ searchParams: Promise.resolve({}) }));

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
    render(await TeamsPage({ searchParams: Promise.resolve({ view: "conference" }) }));

    expect(screen.getByRole("heading", { name: "Eastern Conference" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Western Conference" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Atlantic (East)" })).not.toBeInTheDocument();
  });

  it("renders one flat standings list in league view, best record first", async () => {
    render(await TeamsPage({ searchParams: Promise.resolve({ view: "league" }) }));

    expect(screen.getByRole("heading", { name: "League" })).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /1–0|0–1|—/ });
    expect(links[0]).toHaveTextContent("Toronto Raptors"); // only win in the fixture
  });

  it("marks the active view", async () => {
    render(await TeamsPage({ searchParams: Promise.resolve({ view: "league" }) }));

    expect(screen.getByRole("link", { name: "League" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Division" })).not.toHaveAttribute("aria-current");
  });
});
