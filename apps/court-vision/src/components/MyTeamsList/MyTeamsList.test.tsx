import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { type ReactNode, use, useEffect, useState } from "react";

const deleteLeagueTeamMock = vi.fn();

vi.mock("@/lib/leagues/teamActions", () => ({
  deleteLeagueTeam: (args: { teamId: string }) => deleteLeagueTeamMock(args),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { MyTeamsList } from "@/components/MyTeamsList/MyTeamsList";
import { buildSlots, DEFAULT_SLOT_COUNTS } from "@vision/sport-basketball/engine";
import { teamNameToSlug } from "@vision/core/roster/slug";
import { type FantasyTeam, type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

beforeEach(() => {
  deleteLeagueTeamMock.mockReset().mockResolvedValue({ status: "ok" });
  push.mockClear();
  refresh.mockReset();
});

afterEach(cleanup);

// A refresh that never lands: suspending on it inside the transition that
// called `refresh` holds that transition pending, so the optimistic list is
// observable before the server's new `teams` arrive.
const unresolvedRefresh = new Promise<never>(() => {});

function AwaitRefresh() {
  use(unresolvedRefresh);
  return null;
}

function PendingRefresh({ children }: { children: ReactNode }) {
  const [hasRefreshed, setHasRefreshed] = useState(false);
  useEffect(() => {
    refresh.mockImplementation(() => setHasRefreshed(true));
  }, []);
  return (
    <>
      {children}
      {hasRefreshed && <AwaitRefresh />}
    </>
  );
}

const team = ({ id, name, slug }: { id: string; name: string; slug?: string }): FantasyTeam => ({
  id,
  name,
  slug: slug ?? teamNameToSlug({ name }),
  logoUrl: null,
  managerName: null,
  isMine: false,
  isImported: false,
  unmatchedBySlotId: {},
  createdAt: "2026-07-23T00:00:00.000Z",
  slots: buildSlots<FantasyTeamPlayer>({ counts: DEFAULT_SLOT_COUNTS }).map((slot) =>
    slot.id === "PG-1"
      ? {
          ...slot,
          player: {
            playerId: 1,
            firstName: "Jalen",
            lastName: "Brunson",
            fullName: "Jalen Brunson",
            teamAbbr: "NYK",
            position: "G",
            nbaPersonId: null,
          },
        }
      : slot,
  ),
});

describe("MyTeamsList", () => {
  it("shows the league name and an empty state with a create link", () => {
    render(<MyTeamsList teams={[]} leagueName="Bench Mob League" />);
    expect(screen.getByText("League: Bench Mob League")).toBeInTheDocument();
    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "create your first team" })).toHaveAttribute(
      "href",
      "/my-teams/create",
    );
  });

  it("stacks each team as an accordion with its roster", () => {
    render(
      <MyTeamsList
        teams={[team({ id: "a", name: "Bench Mob" }), team({ id: "b", name: "Second Unit" })]}
        leagueName="Bench Mob League"
      />,
    );
    expect(screen.getAllByText("1/15 slots filled")).toHaveLength(2);
    // Team names link to the slugged edit route.
    expect(screen.getByRole("link", { name: "Bench Mob" })).toHaveAttribute(
      "href",
      "/my-teams/bench-mob",
    );
    expect(screen.getByRole("link", { name: "Second Unit" })).toHaveAttribute(
      "href",
      "/my-teams/second-unit",
    );
    expect(screen.getAllByRole("link", { name: /Jalen Brunson/ })[0]).toHaveAttribute(
      "href",
      "/players/1",
    );
    expect(screen.getAllByText("Injured list")).toHaveLength(2);
  });

  it("deletes a team and refreshes once the delete action confirms", async () => {
    const user = userEvent.setup();
    render(<MyTeamsList teams={[team({ id: "a", name: "Bench Mob" })]} leagueName="League" />);
    await user.click(screen.getByRole("button", { name: "Delete team" }));
    expect(deleteLeagueTeamMock).toHaveBeenCalledWith({ teamId: "a" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("keeps a deleted team gone while the refreshed list is on its way", async () => {
    render(
      <PendingRefresh>
        <MyTeamsList
          teams={[team({ id: "a", name: "Bench Mob" }), team({ id: "b", name: "Second Unit" })]}
          leagueName="League"
        />
      </PendingRefresh>,
    );
    const [firstDelete] = screen.getAllByRole("button", { name: "Delete team" });
    await act(async () => {
      fireEvent.click(firstDelete);
    });
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Bench Mob" })).not.toBeInTheDocument(),
    );
    expect(refresh).toHaveBeenCalled();
    // Still gone a beat later: the pending refresh holds the optimistic list.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.queryByRole("link", { name: "Bench Mob" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Second Unit" })).toBeInTheDocument();
  });

  it("keeps the team visible and shows an alert when the delete throws", async () => {
    deleteLeagueTeamMock.mockReset().mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<MyTeamsList teams={[team({ id: "a", name: "Bench Mob" })]} leagueName="League" />);
    await user.click(screen.getByRole("button", { name: "Delete team" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not delete the team — try again.",
    );
    expect(screen.getByRole("link", { name: "Bench Mob" })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps the team visible and shows an alert when the delete fails", async () => {
    deleteLeagueTeamMock.mockReset().mockResolvedValue({ status: "error" });
    const user = userEvent.setup();
    render(<MyTeamsList teams={[team({ id: "a", name: "Bench Mob" })]} leagueName="League" />);
    await user.click(screen.getByRole("button", { name: "Delete team" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not delete the team — try again.",
    );
    expect(screen.getByRole("link", { name: "Bench Mob" })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("links a renamed team to its stable DB slug, not one recomputed from the new name", () => {
    render(
      <MyTeamsList teams={[team({ id: "a", name: "Beta", slug: "alpha" })]} leagueName="League" />,
    );
    expect(screen.getByRole("link", { name: "Beta" })).toHaveAttribute("href", "/my-teams/alpha");
  });

  it("follows the teams prop when the server sends a new list", () => {
    const { rerender } = render(
      <MyTeamsList teams={[team({ id: "a", name: "Bench Mob" })]} leagueName="League" />,
    );
    expect(screen.getByRole("link", { name: "Bench Mob" })).toBeInTheDocument();
    rerender(<MyTeamsList teams={[]} leagueName="League" />);
    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
  });
});
