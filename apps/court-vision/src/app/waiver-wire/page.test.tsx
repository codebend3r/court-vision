import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { type MyTeamPickerProps } from "@/components/MyTeamPicker/MyTeamPicker";
import { type SyncYahooButtonProps } from "@/components/SyncYahooButton/SyncYahooButton";
import { type WaiverWireViewProps } from "@/components/WaiverWireView/WaiverWireView";
import { type LeagueSummary } from "@/lib/leagues/types";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type WaiverLeagueData } from "@/lib/waiverWire/types";
import { DEFAULT_POINTS_SCORING } from "@vision/sport-basketball/engine";

const getProfile = vi.fn();
const getActiveLeague = vi.fn();
const getLeagueTeams = vi.fn();
const getFantasyPool = vi.fn();
const getWaiverLeagueData = vi.fn();
const getActiveRosterPlayers = vi.fn();
const viewProps = vi.fn();
const pickerProps = vi.fn();
const syncProps = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));
vi.mock("@/lib/leagues/queries", () => ({ getActiveLeague: () => getActiveLeague() }));
type GetLeagueTeamsProps = { leagueId: string };

vi.mock("@/lib/leagues/teamQueries", () => ({
  getLeagueTeams: (args: GetLeagueTeamsProps) => getLeagueTeams(args),
}));
type GetFantasyPoolProps = { range: string };

vi.mock("@/lib/valuation/loader", () => ({
  getFantasyPool: (args: GetFantasyPoolProps) => getFantasyPool(args),
}));
type GetWaiverLeagueDataProps = { leagueId: string; myTeamId: string };

vi.mock("@/lib/waiverWire/loader", () => ({
  getWaiverLeagueData: (args: GetWaiverLeagueDataProps) => getWaiverLeagueData(args),
}));
vi.mock("@/lib/fantasyTeams/loader", () => ({
  getActiveRosterPlayers: () => getActiveRosterPlayers(),
}));
vi.mock("@/components/WaiverWireView/WaiverWireView", () => ({
  WaiverWireView: (props: WaiverWireViewProps) => {
    viewProps(props);
    return <p>waiver wire view</p>;
  },
}));
vi.mock("@/components/MyTeamPicker/MyTeamPicker", () => ({
  MyTeamPicker: (props: MyTeamPickerProps) => {
    pickerProps(props);
    return <p>my team picker</p>;
  },
}));
vi.mock("@/components/SyncYahooButton/SyncYahooButton", () => ({
  SyncYahooButton: (props: SyncYahooButtonProps) => {
    syncProps(props);
    return <button type="button">Sync with Yahoo</button>;
  },
}));

import WaiverWirePage from "@/app/waiver-wire/page";

// Next's redirect() throws an error whose digest encodes the destination
// ("NEXT_REDIRECT;replace;/login?next=/waiver-wire;307;"); reading it is how a
// test observes where a server component sent the visitor.
const redirectTarget = (error: unknown): string =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  typeof error.digest === "string"
    ? error.digest
    : "";

const importedLeague = (overrides: Partial<LeagueSummary> = {}): LeagueSummary => ({
  id: "league-1",
  name: "Game of Courts",
  slug: "game-of-courts",
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts", "reb", "ast"] },
  provider: "yahoo",
  syncVia: "server",
  isImported: true,
  externalUrl: "https://basketball.fantasysports.yahoo.com/nba/106344",
  myTeamId: "team-5",
  syncedAt: "2026-10-16T00:00:00.000Z",
  syncError: null,
  unsupportedCategories: [],
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
  ...overrides,
});

const leagueData: WaiverLeagueData = {
  myRoster: [{ playerId: 1, fullName: "Jalen Brunson", slotType: "BENCH", injuryStatus: null }],
  rosteredPlayerIds: [1, 2],
  waivers: [{ playerId: 3, injuryStatus: null }],
  unmatched: [],
};

const lines = [makeStatLine({ playerId: 1, pts: 900, minutes: 300 })];

type RenderPageProps = { raw?: Record<string, string> };

const renderPage = async ({ raw = {} }: RenderPageProps = {}) =>
  render(await WaiverWirePage({ searchParams: Promise.resolve(raw) }));

const lastViewProps = (): unknown => viewProps.mock.calls.at(-1)?.[0] ?? null;

// A gate stops before the pool, the league's rosters or the active roster.
const expectNothingLoaded = () => {
  expect(getFantasyPool).not.toHaveBeenCalled();
  expect(getWaiverLeagueData).not.toHaveBeenCalled();
  expect(getActiveRosterPlayers).not.toHaveBeenCalled();
};

beforeEach(() => {
  getProfile.mockReset().mockResolvedValue({ id: "profile-1", preferredFormula: null });
  getActiveLeague.mockReset().mockResolvedValue(importedLeague());
  getLeagueTeams.mockReset().mockResolvedValue([]);
  getFantasyPool.mockReset().mockResolvedValue(lines);
  getWaiverLeagueData.mockReset().mockResolvedValue(leagueData);
  getActiveRosterPlayers.mockReset().mockResolvedValue([
    {
      playerId: 1,
      firstName: "Jalen",
      lastName: "Brunson",
      fullName: "Jalen Brunson",
      teamAbbr: "NYK",
      position: "G",
      nbaPersonId: 1628973,
    },
  ]);
  viewProps.mockReset();
  pickerProps.mockReset();
  syncProps.mockReset();
});

afterEach(cleanup);

describe("WaiverWirePage", () => {
  it("sends a signed-out visitor to the login form", async () => {
    getProfile.mockResolvedValue(null);
    const thrown = await WaiverWirePage({ searchParams: Promise.resolve({}) }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(redirectTarget(thrown)).toContain("/login?next=/waiver-wire");
    expectNothingLoaded();
  });

  it("points to the Yahoo import when there is no active league", async () => {
    getActiveLeague.mockResolvedValue(null);
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Waiver Wire" })).toBeInTheDocument();
    expect(screen.getByText("My league")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No league yet. Import your Yahoo league to see who on the wire beats your weakest players.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import from Yahoo" })).toHaveAttribute(
      "href",
      "/leagues/import",
    );
    expect(viewProps).not.toHaveBeenCalled();
    expectNothingLoaded();
  });

  it("asks for a Yahoo import when the active league was built by hand", async () => {
    getActiveLeague.mockResolvedValue(
      importedLeague({ provider: "manual", isImported: false, externalUrl: null, myTeamId: null }),
    );
    await renderPage();

    expect(
      screen.getByText(
        "The Waiver Wire needs a league imported from Yahoo, so it knows every team's roster.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import from Yahoo" })).toHaveAttribute(
      "href",
      "/leagues/import",
    );
    expect(viewProps).not.toHaveBeenCalled();
    expectNothingLoaded();
  });

  it("says points leagues are not supported yet", async () => {
    getActiveLeague.mockResolvedValue(
      importedLeague({
        scoringType: "h2h_points",
        scoringConfig: { scoring: { ...DEFAULT_POINTS_SCORING } },
      }),
    );
    await renderPage();

    expect(
      screen.getByText("The Waiver Wire doesn't support points leagues yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Import from Yahoo" })).not.toBeInTheDocument();
    expect(viewProps).not.toHaveBeenCalled();
    expectNothingLoaded();
  });

  it("asks which team is yours when the imported league has none picked", async () => {
    const teams = [
      {
        id: "team-5",
        name: "Newfoundlanders",
        slug: "newfoundlanders",
        slots: [],
        createdAt: "2026-10-16T00:00:00.000Z",
        logoUrl: null,
        managerName: null,
        isMine: false,
        isImported: true,
        unmatchedBySlotId: {},
      },
    ];
    getLeagueTeams.mockResolvedValue(teams);
    getActiveLeague.mockResolvedValue(importedLeague({ myTeamId: null }));
    await renderPage();

    expect(screen.getByText("Which team is yours?")).toBeInTheDocument();
    expect(getLeagueTeams).toHaveBeenCalledWith({ leagueId: "league-1" });
    expect(pickerProps).toHaveBeenCalledWith({ leagueId: "league-1", teams });
    expect(viewProps).not.toHaveBeenCalled();
    expectNothingLoaded();
  });

  it("renders the view for the URL's range under the league's header", async () => {
    await renderPage({ raw: { range: "last10" } });

    expect(screen.getByRole("heading", { level: 1, name: "Waiver Wire" })).toBeInTheDocument();
    expect(screen.getByText("Game of Courts · Yahoo")).toBeInTheDocument();
    expect(
      screen.getByText("How your league's free agents stack up against your team."),
    ).toBeInTheDocument();
    expect(getFantasyPool).toHaveBeenCalledWith({ range: "last10" });
    expect(getWaiverLeagueData).toHaveBeenCalledWith({
      leagueId: "league-1",
      myTeamId: "team-5",
    });
    expect(lastViewProps()).toMatchObject({
      method: "zscore",
      range: "last10",
      lines,
      activePlayerIds: [1],
      league: leagueData,
    });
  });

  it("values with the league's categories, size and slots", async () => {
    await renderPage();

    expect(lastViewProps()).toMatchObject({
      config: {
        categories: ["pts", "reb", "ast"],
        teams: 12,
        rosterSlots: 13,
        basis: "perGame",
      },
    });
  });

  it("offers a sync and a new-tab link to the league in Yahoo", async () => {
    await renderPage();

    expect(syncProps).toHaveBeenCalledWith({
      leagueId: "league-1",
      syncedAt: "2026-10-16T00:00:00.000Z",
      syncError: null,
      syncVia: "server",
      externalUrl: "https://basketball.fantasysports.yahoo.com/nba/106344",
      autoSyncWhenStale: true,
    });
    const external = screen.getByRole("link", { name: "Open in Yahoo (opens in new tab)" });
    expect(external).toHaveAttribute(
      "href",
      "https://basketball.fantasysports.yahoo.com/nba/106344",
    );
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).not.toHaveAttribute("aria-label");
  });

  it("tells the sync an extension league is synced through the extension", async () => {
    getActiveLeague.mockResolvedValue(importedLeague({ syncVia: "extension" }));
    await renderPage();

    expect(syncProps).toHaveBeenCalledWith(
      expect.objectContaining({
        syncVia: "extension",
        externalUrl: "https://basketball.fantasysports.yahoo.com/nba/106344",
        autoSyncWhenStale: true,
      }),
    );
  });

  it("names the categories it can't value and credits Yahoo", async () => {
    getActiveLeague.mockResolvedValue(importedLeague({ unsupportedCategories: ["DD"] }));
    await renderPage();

    expect(screen.getByText("Not valued: DD")).toBeInTheDocument();
    expect(screen.getByText("League data from Yahoo Fantasy")).toBeInTheDocument();
  });

  it("says nothing about unvalued categories when every one is valued", async () => {
    await renderPage();

    expect(screen.queryByText(/Not valued/)).not.toBeInTheDocument();
    expect(screen.getByText("League data from Yahoo Fantasy")).toBeInTheDocument();
  });

  it("scores with the preferred formula when it is a known method", async () => {
    getProfile.mockResolvedValue({ id: "profile-1", preferredFormula: "gscore" });
    await renderPage();

    expect(lastViewProps()).toMatchObject({ method: "gscore" });
  });

  it("falls back to z-score for an unknown preferred formula", async () => {
    getProfile.mockResolvedValue({ id: "profile-1", preferredFormula: "astrology" });
    await renderPage();

    expect(lastViewProps()).toMatchObject({ method: "zscore" });
  });
});
