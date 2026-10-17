import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { type ReactNode, use, useEffect, useState } from "react";

import { LeagueList } from "@/components/LeagueList/LeagueList";
import { MAX_LEAGUES } from "@vision/core/league/constants";
import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";

const deleteLeagueMock = vi.fn();
const setActiveLeagueMock = vi.fn();

vi.mock("@/lib/leagues/actions", () => ({
  deleteLeague: (args: { leagueId: string }) => deleteLeagueMock(args),
  setActiveLeague: (args: { leagueId: string }) => setActiveLeagueMock(args),
}));

const syncYahooLeagueMock = vi.fn();

vi.mock("@/lib/yahoo/actions", () => ({
  syncYahooLeague: (args: { leagueId: string }) => syncYahooLeagueMock(args),
}));

const refreshMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: pushMock }),
}));

const league = ({
  id,
  name,
  scoringType = "h2h_categories",
  ...overrides
}: {
  id: string;
  name: string;
  scoringType?: LeagueSummary["scoringType"];
} & Partial<LeagueSummary>): LeagueSummary => ({
  id,
  name,
  slug: name.toLowerCase(),
  scoringType,
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
  ...overrides,
});

const YAHOO_URL = "https://basketball.fantasysports.yahoo.com/nba/106344";

const yahooLeague = (overrides: Partial<LeagueSummary> = {}): LeagueSummary =>
  league({
    id: "y",
    name: "Courts",
    provider: "yahoo",
    isImported: true,
    externalUrl: YAHOO_URL,
    myTeamId: "team-1",
    syncedAt: null,
    unsupportedCategories: ["DD"],
    ...overrides,
  });

beforeEach(() => {
  deleteLeagueMock.mockReset().mockResolvedValue({ status: "ok", activeLeagueId: null });
  syncYahooLeagueMock.mockReset();
  setActiveLeagueMock.mockReset().mockResolvedValue({ status: "ok" });
  refreshMock.mockReset();
  pushMock.mockClear();
  useLeaguesStore.setState({
    leagues: [league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })],
    activeLeagueId: "a",
  });
});

afterEach(cleanup);

// A refresh that never lands: suspending on it inside the transition that
// called `refresh` holds that transition pending, so the optimistic state is
// observable before the server's new props arrive.
const unresolvedRefresh = new Promise<never>(() => {});

function AwaitRefresh() {
  use(unresolvedRefresh);
  return null;
}

function PendingRefresh({ children }: { children: ReactNode }) {
  const [hasRefreshed, setHasRefreshed] = useState(false);
  useEffect(() => {
    refreshMock.mockImplementation(() => setHasRefreshed(true));
  }, []);
  return (
    <>
      {children}
      {hasRefreshed && <AwaitRefresh />}
    </>
  );
}

const twoLeagues = () => [league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })];

// Long enough for a transition that was going to settle to have settled.
const aBeatLater = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

const cardOf = ({ name }: { name: string }): HTMLElement => {
  const card = screen.getByRole("link", { name }).closest("li");
  if (card === null) throw new Error(`no card for ${name}`);
  return card;
};

describe("LeagueList", () => {
  it("renders one card per league with name and scoring-type label", () => {
    render(
      <LeagueList
        leagues={[
          league({ id: "a", name: "Alpha", scoringType: "h2h_categories" }),
          league({ id: "b", name: "Beta", scoringType: "h2h_points" }),
        ]}
        activeLeagueId="a"
      />,
    );
    expect(screen.getByRole("link", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Beta" })).toBeInTheDocument();
    // The scoring label appears on the badge and again in the fact grid.
    expect(screen.getAllByText("H2H Categories").length).toBe(2);
    expect(screen.getAllByText("H2H Points").length).toBe(2);
  });

  it("marks the active league card's Active button as pressed", () => {
    render(
      <LeagueList
        leagues={[league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })]}
        activeLeagueId="a"
      />,
    );
    expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute("aria-pressed", "true");
  });

  it("calls setActiveLeague when Set active is clicked on another card", async () => {
    render(
      <LeagueList
        leagues={[league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })]}
        activeLeagueId="a"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Set active" }));
    expect(setActiveLeagueMock).toHaveBeenCalledWith({ leagueId: "b" });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("is a no-op when Active is clicked on the already-active card", () => {
    render(
      <LeagueList
        leagues={[league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })]}
        activeLeagueId="a"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(setActiveLeagueMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("reverts the active league and shows an alert when setActiveLeague fails", async () => {
    setActiveLeagueMock.mockReset().mockResolvedValue({ status: "error" });
    render(
      <LeagueList
        leagues={[league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })]}
        activeLeagueId="a"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Set active" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not switch leagues — try again.",
    );
    // The optimistic flip falls back to the server's league once the action ends.
    await waitFor(() =>
      expect(
        within(cardOf({ name: "Alpha" })).getByRole("button", { name: "Active" }),
      ).toBeVisible(),
    );
    expect(useLeaguesStore.getState().activeLeagueId).toBe("a");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("reverts the active league and shows an alert when setActiveLeague throws", async () => {
    setActiveLeagueMock.mockReset().mockRejectedValue(new Error("network down"));
    render(<LeagueList leagues={twoLeagues()} activeLeagueId="a" />);
    fireEvent.click(screen.getByRole("button", { name: "Set active" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not switch leagues — try again.",
    );
    await waitFor(() =>
      expect(
        within(cardOf({ name: "Alpha" })).getByRole("button", { name: "Active" }),
      ).toBeVisible(),
    );
    expect(useLeaguesStore.getState().activeLeagueId).toBe("a");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows the new active league while the refresh is on its way", async () => {
    render(
      <PendingRefresh>
        <LeagueList leagues={twoLeagues()} activeLeagueId="a" />
      </PendingRefresh>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Set active" }));
    });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    await aBeatLater();
    expect(within(cardOf({ name: "Beta" })).getByRole("button", { name: "Active" })).toBeVisible();
    expect(
      within(cardOf({ name: "Alpha" })).getByRole("button", { name: "Set active" }),
    ).toBeVisible();
    expect(useLeaguesStore.getState().activeLeagueId).toBe("b");
  });

  it("follows the server's active league once it lands", () => {
    const { rerender } = render(<LeagueList leagues={twoLeagues()} activeLeagueId="a" />);
    rerender(<LeagueList leagues={twoLeagues()} activeLeagueId="b" />);
    expect(within(cardOf({ name: "Beta" })).getByRole("button", { name: "Active" })).toBeVisible();
  });

  it("requires a second click to delete a league", async () => {
    render(
      <LeagueList
        leagues={[league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })]}
        activeLeagueId="a"
      />,
    );
    const [firstDelete] = screen.getAllByRole("button", { name: /^Delete/ });
    fireEvent.click(firstDelete);
    expect(deleteLeagueMock).not.toHaveBeenCalled();
    const confirmButton = screen.getByRole("button", { name: /Confirm delete/ });
    fireEvent.click(confirmButton);
    expect(deleteLeagueMock).toHaveBeenCalledWith({ leagueId: "a" });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("keeps the card visible and shows an alert when delete fails", async () => {
    deleteLeagueMock.mockReset().mockResolvedValue({ status: "error" });
    render(
      <LeagueList
        leagues={[league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })]}
        activeLeagueId="a"
      />,
    );
    const [firstDelete] = screen.getAllByRole("button", { name: /^Delete/ });
    fireEvent.click(firstDelete);
    fireEvent.click(screen.getByRole("button", { name: /Confirm delete/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not delete the league — try again.",
    );
    expect(screen.getByRole("link", { name: "Alpha" })).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("keeps the card visible and shows an alert when delete throws", async () => {
    deleteLeagueMock.mockReset().mockRejectedValue(new Error("network down"));
    render(<LeagueList leagues={twoLeagues()} activeLeagueId="a" />);
    const [firstDelete] = screen.getAllByRole("button", { name: /^Delete/ });
    fireEvent.click(firstDelete);
    fireEvent.click(screen.getByRole("button", { name: /Confirm delete/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not delete the league — try again.",
    );
    expect(screen.getByRole("link", { name: "Alpha" })).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("keeps a deleted league's card gone while the refresh is on its way", async () => {
    render(
      <PendingRefresh>
        <LeagueList leagues={twoLeagues()} activeLeagueId="a" />
      </PendingRefresh>,
    );
    const [firstDelete] = screen.getAllByRole("button", { name: /^Delete/ });
    fireEvent.click(firstDelete);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirm delete/ }));
    });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    await aBeatLater();
    expect(screen.queryByRole("link", { name: "Alpha" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByText("1 of 10 leagues")).toBeInTheDocument();
    expect(useLeaguesStore.getState().leagues.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("replaces the Create league link with cap copy at MAX_LEAGUES", () => {
    const leagues = Array.from({ length: MAX_LEAGUES }, (_, index) =>
      league({ id: `id-${index}`, name: `League ${index}` }),
    );
    render(<LeagueList leagues={leagues} activeLeagueId="id-0" />);
    expect(screen.queryByRole("link", { name: "Create league" })).not.toBeInTheDocument();
    expect(screen.getByText("Limit reached (10)")).toBeInTheDocument();
  });

  it("shows the Create league link when under the cap", () => {
    render(<LeagueList leagues={[league({ id: "a", name: "Alpha" })]} activeLeagueId="a" />);
    expect(screen.getByRole("link", { name: "Create league" })).toBeInTheDocument();
  });

  it("shows an empty state with no leagues", () => {
    render(<LeagueList leagues={[]} activeLeagueId={null} />);
    expect(screen.getByText(/create your first league/i)).toBeInTheDocument();
  });

  it("offers a Yahoo import beside Create league", () => {
    render(<LeagueList leagues={[league({ id: "a", name: "Alpha" })]} activeLeagueId="a" />);
    expect(screen.getByRole("link", { name: "Import from Yahoo" })).toHaveAttribute(
      "href",
      "/leagues/import",
    );
  });

  it("offers a Yahoo import in the empty state", () => {
    render(<LeagueList leagues={[]} activeLeagueId={null} />);
    expect(screen.getByRole("link", { name: "Import from Yahoo" })).toHaveAttribute(
      "href",
      "/leagues/import",
    );
  });

  it("hides the Yahoo import at MAX_LEAGUES", () => {
    const leagues = Array.from({ length: MAX_LEAGUES }, (_, index) =>
      league({ id: `id-${index}`, name: `League ${index}` }),
    );
    render(<LeagueList leagues={leagues} activeLeagueId="id-0" />);
    expect(screen.queryByRole("link", { name: "Import from Yahoo" })).not.toBeInTheDocument();
  });

  it("marks an imported league's card as Yahoo's, with its link, sync and credit", () => {
    render(<LeagueList leagues={[yahooLeague()]} activeLeagueId="y" />);
    const card = cardOf({ name: "Courts" });

    expect(within(card).getByText("Yahoo")).toBeInTheDocument();
    const yahooLink = within(card).getByRole("link", { name: "Open in Yahoo: Courts" });
    expect(yahooLink).toHaveAttribute("href", YAHOO_URL);
    expect(yahooLink).toHaveAttribute("target", "_blank");
    expect(yahooLink).toHaveAttribute("rel", "noreferrer");
    expect(yahooLink).toHaveTextContent("Open in Yahoo (opens in new tab)");
    expect(yahooLink).toHaveAccessibleDescription("(opens in new tab)");
    expect(within(card).getByRole("button", { name: "Sync with Yahoo: Courts" })).toHaveTextContent(
      "Sync with Yahoo",
    );
    expect(within(card).getByText("Not valued: DD")).toBeInTheDocument();
    expect(within(card).getByText("League data from Yahoo Fantasy")).toBeInTheDocument();
  });

  it("leaves the not-valued warning off an imported league that values every category", () => {
    render(
      <LeagueList leagues={[yahooLeague({ unsupportedCategories: [] })]} activeLeagueId="y" />,
    );

    expect(screen.queryByText(/Not valued/)).not.toBeInTheDocument();
  });

  it("shows none of the Yahoo pieces on a hand-built league's card", () => {
    render(<LeagueList leagues={[league({ id: "a", name: "Alpha" })]} activeLeagueId="a" />);
    const card = cardOf({ name: "Alpha" });

    expect(within(card).queryByText("Yahoo")).not.toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: /Open in Yahoo/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /Sync with Yahoo/ })).not.toBeInTheDocument();
    expect(within(card).queryByText(/Not valued/)).not.toBeInTheDocument();
    expect(within(card).queryByText("League data from Yahoo Fantasy")).not.toBeInTheDocument();
  });
});
