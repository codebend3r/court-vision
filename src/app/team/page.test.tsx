import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getTeamRoster, getTeamStats } from "@/lib/teams/loader";
import { buildTeamStats } from "@/lib/teams/stats";

import TeamPage from "@/app/team/page";

vi.mock("@/lib/teams/loader", () => ({
  getTeamStats: vi.fn(),
  getTeamRoster: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTeamRoster).mockResolvedValue([
    {
      id: 101,
      firstName: "Jalen",
      lastName: "Brunson",
      fullName: "Jalen Brunson",
      position: "G",
      jerseyNumber: "11",
      nbaPersonId: null,
      teamAbbr: "NYK",
    },
    {
      id: 102,
      firstName: "Karl-Anthony",
      lastName: "Towns",
      fullName: "Karl-Anthony Towns",
      position: "C-F",
      jerseyNumber: "32",
      nbaPersonId: null,
      teamAbbr: "NYK",
    },
  ]);
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
        {
          teamAbbr: "BOS",
          pts: 100,
          reb: 45,
          ast: 20,
          stl: 6,
          blk: 4,
          tov: 18,
          fg3m: 10,
          fgm: 40,
          fga: 95,
          ftm: 10,
          fta: 12,
        },
      ],
    }),
  });
});

afterEach(cleanup);

describe("TeamPage", () => {
  it("shows the team header, record, and ranked stats", async () => {
    render(await TeamPage({ searchParams: Promise.resolve({ is: "raptors" }) }));

    expect(screen.getByRole("heading", { name: "Toronto Raptors" })).toBeInTheDocument();
    expect(screen.getByText(/Atlantic Division · Eastern Conference/)).toBeInTheDocument();
    expect(screen.getByText("1–0")).toBeInTheDocument();
    expect(screen.getByText("PPG")).toBeInTheDocument();
    expect(screen.getByText("120.0")).toBeInTheDocument();
    // Two teams in the fixture league: Toronto leads PPG, trails RPG.
    expect(screen.getAllByText("1st of 2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2nd of 2").length).toBeGreaterThan(0);
  });

  it("ranks lower-is-better stats ascending", async () => {
    render(await TeamPage({ searchParams: Promise.resolve({ is: "raptors" }) }));

    const topgRow = screen.getByText("TOPG").closest("tr");
    expect(topgRow).not.toBeNull();
    expect(topgRow?.textContent).toContain("1st of 2"); // 12 turnovers < 18
  });

  it("lists the entire roster with links to player pages", async () => {
    render(await TeamPage({ searchParams: Promise.resolve({ is: "raptors" }) }));

    expect(getTeamRoster).toHaveBeenCalledWith({ abbr: "TOR" });
    const rosterHeading = screen.getByRole("heading", { name: "Roster" });
    expect(rosterHeading).toBeInTheDocument();
    // Roster renders first (left column), stats beside it.
    const statHeader = screen.getByRole("columnheader", { name: "Stat" });
    expect(
      !!(rosterHeading.compareDocumentPosition(statHeader) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /Jalen Brunson/ })).toHaveAttribute(
      "href",
      "/players/101",
    );
    expect(screen.getByText("#32")).toBeInTheDocument();
  });

  it("renders a not-found notice for unknown slugs", async () => {
    render(await TeamPage({ searchParams: Promise.resolve({ is: "gremlins" }) }));

    expect(screen.getByText(/No team matches/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse all teams" })).toHaveAttribute(
      "href",
      "/teams",
    );
  });

  it("notices missing data for a known team without stats", async () => {
    vi.mocked(getTeamStats).mockResolvedValue({ season: null, stats: [] });

    render(await TeamPage({ searchParams: Promise.resolve({ is: "raptors" }) }));

    expect(screen.getByRole("heading", { name: "Toronto Raptors" })).toBeInTheDocument();
    expect(screen.getByText(/No game data for this team yet/)).toBeInTheDocument();
  });
});
