import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { MyTeamsList } from "@/components/MyTeamsList/MyTeamsList";
import { buildSlots, DEFAULT_SLOT_COUNTS } from "@/lib/fantasyTeams/slots";
import { useFantasyTeamsStore } from "@/lib/fantasyTeams/store";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";

beforeEach(() => {
  useFantasyTeamsStore.setState({ teams: [] });
});

afterEach(cleanup);

const team = ({ id, name }: { id: string; name: string }): FantasyTeam => ({
  id,
  name,
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
  it("shows an empty state with a create link", () => {
    render(<MyTeamsList />);
    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "create your first team" })).toHaveAttribute(
      "href",
      "/my-teams/create",
    );
  });

  it("stacks each team as an accordion with its roster", () => {
    useFantasyTeamsStore.setState({
      teams: [team({ id: "a", name: "Bench Mob" }), team({ id: "b", name: "Second Unit" })],
    });
    render(<MyTeamsList />);
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

  it("deletes a team", async () => {
    useFantasyTeamsStore.setState({ teams: [team({ id: "a", name: "Bench Mob" })] });
    const user = userEvent.setup();
    render(<MyTeamsList />);
    await user.click(screen.getByRole("button", { name: "Delete team" }));
    expect(useFantasyTeamsStore.getState().teams).toHaveLength(0);
    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
  });
});
