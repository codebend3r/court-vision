import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { type MyTeamsListProps } from "@/components/MyTeamsList/MyTeamsList";
import { type LeagueSummary } from "@/lib/leagues/types";

const getProfile = vi.fn();
const getActiveLeague = vi.fn();
const getLeagueTeams = vi.fn();
const listProps = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));
vi.mock("@/lib/leagues/queries", () => ({ getActiveLeague: () => getActiveLeague() }));
type GetLeagueTeamsProps = { leagueId: string };

vi.mock("@/lib/leagues/teamQueries", () => ({
  getLeagueTeams: (args: GetLeagueTeamsProps) => getLeagueTeams(args),
}));
vi.mock("@/components/MyTeamsList/MyTeamsList", () => ({
  MyTeamsList: (props: MyTeamsListProps) => {
    listProps(props);
    return <p>my teams list</p>;
  },
}));

import MyTeamsPage from "@/app/my-teams/page";

// Next's redirect() throws an error whose digest encodes the destination
// ("NEXT_REDIRECT;replace;/login?next=/my-teams;307;"); reading it is how a
// test observes where a server component sent the visitor.
const redirectTarget = (error: unknown): string =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  typeof error.digest === "string"
    ? error.digest
    : "";

const noParams = Promise.resolve({});

type LeagueProps = { id: string; name: string };

const league = ({ id, name }: LeagueProps): LeagueSummary => ({
  id,
  name,
  slug: name.toLowerCase(),
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
  provider: "manual",
  syncVia: "server",
  isImported: false,
  externalUrl: null,
  myTeamId: null,
  syncedAt: null,
  syncError: null,
  unsupportedCategories: [],
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
});

beforeEach(() => {
  getProfile.mockReset().mockResolvedValue({ id: "profile-1" });
  getActiveLeague.mockReset();
  getLeagueTeams.mockReset().mockResolvedValue([]);
  listProps.mockReset();
});

afterEach(cleanup);

describe("MyTeamsPage", () => {
  it("sends a signed-out visitor to the login form", async () => {
    getProfile.mockResolvedValue(null);
    const thrown = await MyTeamsPage({ searchParams: noParams }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(redirectTarget(thrown)).toContain("/login?next=/my-teams");
  });

  it("prompts to create a league when there is no active league", async () => {
    getActiveLeague.mockResolvedValue(null);
    render(await MyTeamsPage({ searchParams: noParams }));
    expect(screen.getByRole("heading", { name: "Fantasy League" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "create a league" })).toHaveAttribute(
      "href",
      "/leagues/create",
    );
    expect(getLeagueTeams).not.toHaveBeenCalled();
  });

  it("renders the heading, create link, and scopes the team list to the active league", async () => {
    getActiveLeague.mockResolvedValue(league({ id: "league-1", name: "Bench Mob League" }));
    const teams = [
      { id: "a", name: "Bench Mob", createdAt: "2026-07-23T00:00:00.000Z", slots: [] },
    ];
    getLeagueTeams.mockResolvedValue(teams);

    render(await MyTeamsPage({ searchParams: noParams }));

    expect(screen.getByRole("heading", { name: "Fantasy League" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New team" })).toHaveAttribute(
      "href",
      "/my-teams/create",
    );
    expect(getLeagueTeams).toHaveBeenCalledWith({ leagueId: "league-1" });
    expect(listProps).toHaveBeenCalledWith({
      teams,
      leagueName: "Bench Mob League",
      isImported: false,
      openTeamId: null,
    });
  });

  it("offers no New team for an imported league and tells the list it is imported", async () => {
    getActiveLeague.mockResolvedValue({
      ...league({ id: "league-1", name: "Game of Courts" }),
      provider: "yahoo",
      isImported: true,
    });

    render(await MyTeamsPage({ searchParams: noParams }));

    expect(screen.queryByRole("link", { name: "New team" })).not.toBeInTheDocument();
    expect(listProps).toHaveBeenCalledWith({
      teams: [],
      leagueName: "Game of Courts",
      isImported: true,
      openTeamId: null,
    });
  });

  it("hands the list the team id to open, from the open query", async () => {
    getActiveLeague.mockResolvedValue(league({ id: "league-1", name: "Game of Courts" }));

    render(await MyTeamsPage({ searchParams: Promise.resolve({ open: "team-5" }) }));

    expect(listProps).toHaveBeenCalledWith(expect.objectContaining({ openTeamId: "team-5" }));
  });

  it("ignores a repeated open query", async () => {
    getActiveLeague.mockResolvedValue(league({ id: "league-1", name: "Game of Courts" }));

    render(await MyTeamsPage({ searchParams: Promise.resolve({ open: ["a", "b"] }) }));

    expect(listProps).toHaveBeenCalledWith(expect.objectContaining({ openTeamId: null }));
  });
});
