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
vi.mock("@/lib/leagues/teamQueries", () => ({
  getLeagueTeams: (args: { leagueId: string }) => getLeagueTeams(args),
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

const league = ({ id, name }: { id: string; name: string }): LeagueSummary => ({
  id,
  name,
  slug: name.toLowerCase(),
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
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
    const thrown = await MyTeamsPage().then(
      () => null,
      (error: unknown) => error,
    );
    expect(redirectTarget(thrown)).toContain("/login?next=/my-teams");
  });

  it("prompts to create a league when there is no active league", async () => {
    getActiveLeague.mockResolvedValue(null);
    render(await MyTeamsPage());
    expect(screen.getByRole("heading", { name: "My Teams" })).toBeInTheDocument();
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

    render(await MyTeamsPage());

    expect(screen.getByRole("heading", { name: "My Teams" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create team" })).toHaveAttribute(
      "href",
      "/my-teams/create",
    );
    expect(getLeagueTeams).toHaveBeenCalledWith({ leagueId: "league-1" });
    expect(listProps).toHaveBeenCalledWith({ teams, leagueName: "Bench Mob League" });
  });
});
