import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { makeStatLine } from "@/lib/valuation/fixtures";
import { type LeagueSummary } from "@/lib/leagues/types";

const getProfile = vi.fn();
const getActiveLeague = vi.fn();
const getFantasyPool = vi.fn();
const getActiveRosterPlayers = vi.fn();
const saveLeagueTeam = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));
vi.mock("@/lib/leagues/queries", () => ({ getActiveLeague: () => getActiveLeague() }));
vi.mock("@/lib/valuation/loader", () => ({ getFantasyPool }));
vi.mock("@/lib/fantasyTeams/loader", () => ({ getActiveRosterPlayers }));
vi.mock("@/lib/leagues/teamActions", () => ({ saveLeagueTeam }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import CreateTeamPage from "@/app/my-teams/create/page";

// Next's redirect() throws an error whose digest encodes the destination.
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
  vi.clearAllMocks();
  getProfile.mockResolvedValue({ id: "profile-1" });
  getActiveLeague.mockResolvedValue(league({ id: "league-1", name: "Bench Mob League" }));
  getFantasyPool.mockResolvedValue([makeStatLine({ playerId: 1 })]);
  getActiveRosterPlayers.mockResolvedValue([]);
});

afterEach(cleanup);

describe("CreateTeamPage", () => {
  it("sends a signed-out visitor to the login form", async () => {
    getProfile.mockResolvedValue(null);
    const thrown = await CreateTeamPage().then(
      () => null,
      (error: unknown) => error,
    );
    expect(redirectTarget(thrown)).toContain("/login?next=/my-teams");
  });

  it("prompts to create a league when there is no active league", async () => {
    getActiveLeague.mockResolvedValue(null);
    render(await CreateTeamPage());
    expect(screen.getByRole("heading", { name: "Create team" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "create a league" })).toHaveAttribute(
      "href",
      "/leagues/create",
    );
    expect(getFantasyPool).not.toHaveBeenCalled();
  });

  it("renders the builder over the cached player pool, scoped to the active league", async () => {
    render(await CreateTeamPage());
    expect(screen.getByRole("heading", { name: "Create team" })).toBeInTheDocument();
    expect(getFantasyPool).toHaveBeenCalledWith({ range: "all" });
    expect(screen.getByLabelText("Team name")).toBeInTheDocument();
    expect(screen.getByLabelText("Search players")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My teams" })).toHaveAttribute("href", "/my-teams");
  });

  it("lets a rookie with no stats be found and added", async () => {
    const user = userEvent.setup();
    getActiveRosterPlayers.mockResolvedValue([
      {
        playerId: 1057262817,
        firstName: "AJ",
        lastName: "Dybantsa",
        fullName: "AJ Dybantsa",
        teamAbbr: "WAS",
        position: "F",
        nbaPersonId: null,
      },
    ]);
    render(await CreateTeamPage());

    await user.type(screen.getByLabelText("Search players"), "Dybantsa");

    expect(screen.getByRole("button", { name: "Add AJ Dybantsa" })).toBeEnabled();
  });

  it("sends an imported league back to My teams", async () => {
    getActiveLeague.mockResolvedValue({
      ...league({ id: "league-1", name: "Game of Courts" }),
      provider: "yahoo",
      isImported: true,
    });
    const thrown = await CreateTeamPage().then(
      () => null,
      (error: unknown) => error,
    );
    expect(redirectTarget(thrown)).toContain(";/my-teams;");
    expect(getFantasyPool).not.toHaveBeenCalled();
  });
});
