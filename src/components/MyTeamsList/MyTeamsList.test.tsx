import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

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
import { buildSlots, DEFAULT_SLOT_COUNTS } from "@/lib/fantasyTeams/slots";
import { teamNameToSlug } from "@/lib/fantasyTeams/slug";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";

beforeEach(() => {
  deleteLeagueTeamMock.mockReset().mockResolvedValue({ status: "ok-deleted" });
  push.mockClear();
  refresh.mockClear();
});

afterEach(cleanup);

const team = ({ id, name, slug }: { id: string; name: string; slug?: string }): FantasyTeam => ({
  id,
  name,
  slug: slug ?? teamNameToSlug(name),
  createdAt: "2026-07-23T00:00:00.000Z",
  slots: buildSlots({ counts: DEFAULT_SLOT_COUNTS }).map((slot) =>
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
    await waitFor(() => expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument());
    expect(refresh).toHaveBeenCalled();
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

  it("re-syncs local state when the teams prop changes", () => {
    const { rerender } = render(
      <MyTeamsList teams={[team({ id: "a", name: "Bench Mob" })]} leagueName="League" />,
    );
    expect(screen.getByRole("link", { name: "Bench Mob" })).toBeInTheDocument();
    rerender(<MyTeamsList teams={[]} leagueName="League" />);
    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
  });
});
