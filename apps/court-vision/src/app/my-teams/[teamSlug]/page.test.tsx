import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { buildSlots, DEFAULT_SLOT_COUNTS } from "@vision/sport-basketball/engine";
import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";
import { type LeagueSummary } from "@/lib/leagues/types";
import { makeStatLine } from "@/lib/valuation/fixtures";

const getProfile = vi.fn();
const getActiveLeague = vi.fn();
const getLeagueTeamBySlug = vi.fn();
const getFantasyPool = vi.fn();
const getActiveRosterPlayers = vi.fn();
const saveLeagueTeam = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));
vi.mock("@/lib/leagues/queries", () => ({ getActiveLeague: () => getActiveLeague() }));
vi.mock("@/lib/leagues/teamQueries", () => ({
  getLeagueTeamBySlug: (args: { leagueId: string; slug: string }) => getLeagueTeamBySlug(args),
}));
vi.mock("@/lib/valuation/loader", () => ({ getFantasyPool }));
vi.mock("@/lib/fantasyTeams/loader", () => ({ getActiveRosterPlayers }));
vi.mock("@/lib/leagues/teamActions", () => ({ saveLeagueTeam }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import EditTeamPage from "@/app/my-teams/[teamSlug]/page";

// Next's redirect()/notFound() throw errors whose digest encodes the outcome
// ("NEXT_REDIRECT;..." or "NEXT_HTTP_ERROR_FALLBACK;404"); reading it is how a
// test observes what a server component did without a real router.
const digestOf = (error: unknown): string =>
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

describe("EditTeamPage", () => {
  it("sends a signed-out visitor to the login form", async () => {
    getProfile.mockResolvedValue(null);
    const thrown = await EditTeamPage({ params: Promise.resolve({ teamSlug: "bench-mob" }) }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(digestOf(thrown)).toContain("/login?next=/my-teams");
  });

  it("prompts to create a league when there is no active league", async () => {
    getActiveLeague.mockResolvedValue(null);
    render(await EditTeamPage({ params: Promise.resolve({ teamSlug: "bench-mob" }) }));
    expect(screen.getByRole("heading", { name: "Edit team" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "create a league" })).toHaveAttribute(
      "href",
      "/leagues/create",
    );
    expect(getLeagueTeamBySlug).not.toHaveBeenCalled();
  });

  it("loads the database team by slug into the builder", async () => {
    getLeagueTeamBySlug.mockResolvedValue({
      id: "team-1",
      name: "Bench Mob",
      createdAt: "2026-07-23T00:00:00.000Z",
      slots: buildSlots<FantasyTeamPlayer>({ counts: DEFAULT_SLOT_COUNTS }),
    });

    render(await EditTeamPage({ params: Promise.resolve({ teamSlug: "bench-mob" }) }));

    expect(getLeagueTeamBySlug).toHaveBeenCalledWith({ leagueId: "league-1", slug: "bench-mob" });
    expect(screen.getByRole("heading", { name: "Bench Mob" })).toBeInTheDocument();
    expect(screen.getByLabelText("Team name")).toHaveValue("Bench Mob");
    expect(screen.getByLabelText("Search players")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My teams" })).toHaveAttribute("href", "/my-teams");
  });

  it("404s on unknown slugs", async () => {
    getLeagueTeamBySlug.mockResolvedValue(null);
    const thrown = await EditTeamPage({
      params: Promise.resolve({ teamSlug: "ghost-squad" }),
    }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(digestOf(thrown)).toContain("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("sends an imported league back to My teams", async () => {
    getActiveLeague.mockResolvedValue({
      ...league({ id: "league-1", name: "Game of Courts" }),
      provider: "yahoo",
      isImported: true,
    });
    const thrown = await EditTeamPage({
      params: Promise.resolve({ teamSlug: "better-call-gasol" }),
    }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(digestOf(thrown)).toContain(";/my-teams;");
    expect(getLeagueTeamBySlug).not.toHaveBeenCalled();
  });

  it("sends an imported team back to My teams", async () => {
    getLeagueTeamBySlug.mockResolvedValue({
      id: "team-1",
      name: "Better Call Gasol",
      createdAt: "2026-07-23T00:00:00.000Z",
      isImported: true,
      slots: buildSlots<FantasyTeamPlayer>({ counts: DEFAULT_SLOT_COUNTS }),
    });
    const thrown = await EditTeamPage({
      params: Promise.resolve({ teamSlug: "better-call-gasol" }),
    }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(digestOf(thrown)).toContain(";/my-teams;");
  });
});
