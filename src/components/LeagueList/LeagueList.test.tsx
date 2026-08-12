import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { LeagueList } from "@/components/LeagueList/LeagueList";
import { MAX_LEAGUES } from "@/lib/leagues/constants";
import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";

const deleteLeagueMock = vi.fn();
const setActiveLeagueMock = vi.fn();

vi.mock("@/lib/leagues/actions", () => ({
  deleteLeague: (args: { leagueId: string }) => deleteLeagueMock(args),
  setActiveLeague: (args: { leagueId: string }) => setActiveLeagueMock(args),
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
}: {
  id: string;
  name: string;
  scoringType?: LeagueSummary["scoringType"];
}): LeagueSummary => ({
  id,
  name,
  slug: name.toLowerCase(),
  scoringType,
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
});

beforeEach(() => {
  deleteLeagueMock.mockReset().mockResolvedValue({ status: "ok", activeLeagueId: null });
  setActiveLeagueMock.mockReset().mockResolvedValue({ status: "ok" });
  refreshMock.mockClear();
  pushMock.mockClear();
  useLeaguesStore.setState({
    leagues: [league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })],
    activeLeagueId: "a",
  });
});

afterEach(cleanup);

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
    expect(screen.getByRole("button", { name: "Active" })).toBeInTheDocument();
    expect(useLeaguesStore.getState().activeLeagueId).toBe("a");
    expect(refreshMock).not.toHaveBeenCalled();
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
});
