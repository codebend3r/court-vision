import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { TeamBuilder } from "@/components/TeamBuilder/TeamBuilder";
import { buildSlots, DEFAULT_SLOT_COUNTS } from "@/lib/fantasyTeams/slots";
import { type FantasyTeamPlayer, type RosterSlot } from "@/lib/fantasyTeams/types";

const saveLeagueTeamMock = vi.fn();

vi.mock("@/lib/leagues/teamActions", () => ({
  saveLeagueTeam: (args: {
    leagueId: string;
    teamId: string | null;
    name: string;
    slots: readonly RosterSlot[];
  }) => saveLeagueTeamMock(args),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const LEAGUE_ID = "league-1";

beforeEach(() => {
  vi.clearAllMocks();
  saveLeagueTeamMock.mockResolvedValue({
    status: "ok",
    team: {
      id: "server-team-1",
      name: "Bench Mob",
      slots: [],
      createdAt: "2026-07-23T00:00:00.000Z",
    },
  });
});

afterEach(cleanup);

const player = (
  overrides: Partial<FantasyTeamPlayer> & { playerId: number },
): FantasyTeamPlayer => ({
  firstName: "Test",
  lastName: `Player ${overrides.playerId}`,
  fullName: `Test Player ${overrides.playerId}`,
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
  ...overrides,
});

const players = [
  player({ playerId: 1, firstName: "Jalen", lastName: "Brunson", fullName: "Jalen Brunson" }),
  player({
    playerId: 2,
    firstName: "Karl-Anthony",
    lastName: "Towns",
    fullName: "Karl-Anthony Towns",
    position: "C-F",
  }),
  player({ playerId: 3, firstName: "Josh", lastName: "Hart", fullName: "Josh Hart" }),
];

const searchFor = async (text: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Search players"), text);
  return user;
};

describe("TeamBuilder", () => {
  it("renders the default 15-slot roster and settings", () => {
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} />);
    expect(screen.getByLabelText("Team name")).toBeInTheDocument();
    expect(screen.getByText("0 of 15 slots filled")).toBeInTheDocument();
    expect(screen.getAllByText("Empty")).toHaveLength(15);
    expect(screen.getByLabelText("Injured List Plus slots")).toBeInTheDocument();
  });

  it("searches by first or last name", async () => {
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} />);
    await searchFor("brun");
    expect(screen.getByText("Jalen Brunson")).toBeInTheDocument();
    expect(screen.queryByText("Karl-Anthony Towns")).not.toBeInTheDocument();
  });

  it("adds a player to the first eligible slot with the + button", async () => {
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} />);
    const user = await searchFor("towns");
    await user.click(screen.getByRole("button", { name: "Add Karl-Anthony Towns" }));
    expect(screen.getByText("1 of 15 slots filled")).toBeInTheDocument();
    // A C-F fills SF first (position slots before UTIL, roster order).
    const slot = document.querySelector('[data-slot-id="SF-1"]');
    expect(slot?.textContent).toContain("Karl-Anthony Towns");
    expect(screen.getByRole("button", { name: "Add Karl-Anthony Towns" })).toBeDisabled();
  });

  it("changes roster shape from the settings steppers", async () => {
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} />);
    const user = userEvent.setup();
    const bench = screen.getByLabelText("Bench slots");
    await user.clear(bench);
    await user.type(bench, "5");
    await user.tab();
    expect(screen.getByText("0 of 17 slots filled")).toBeInTheDocument();
  });

  it("highlights eligible slots green and ineligible red during a drag", async () => {
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} />);
    await searchFor("brunson");
    const card = screen.getByText("Jalen Brunson").closest("li");
    if (card === null) throw new Error("card not rendered");
    fireEvent.dragStart(card, {
      dataTransfer: { setData: vi.fn(), effectAllowed: "move" },
    });
    // Guard: PG/SG/G/UTIL/bench/IL light up, forward and center slots refuse.
    expect(document.querySelector('[data-slot-id="PG-1"]')).toHaveAttribute("data-drop", "ok");
    expect(document.querySelector('[data-slot-id="UTIL-1"]')).toHaveAttribute("data-drop", "ok");
    expect(document.querySelector('[data-slot-id="IL-1"]')).toHaveAttribute("data-drop", "ok");
    expect(document.querySelector('[data-slot-id="C-1"]')).toHaveAttribute("data-drop", "no");
    expect(document.querySelector('[data-slot-id="SF-1"]')).toHaveAttribute("data-drop", "no");
    fireEvent.dragEnd(card);
    expect(document.querySelector('[data-slot-id="PG-1"]')).not.toHaveAttribute("data-drop");
  });

  it("assigns a player on drop into an eligible slot", async () => {
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} />);
    await searchFor("brunson");
    const card = screen.getByText("Jalen Brunson").closest("li");
    const slot = document.querySelector('[data-slot-id="G-1"]');
    if (card === null || slot === null) throw new Error("card or slot missing");
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: "move" } });
    fireEvent.drop(slot, { dataTransfer: { getData: () => "1" } });
    expect(slot.textContent).toContain("Jalen Brunson");
  });

  it("ignores drops into ineligible slots", async () => {
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} />);
    await searchFor("brunson");
    const card = screen.getByText("Jalen Brunson").closest("li");
    const center = document.querySelector('[data-slot-id="C-1"]');
    if (card === null || center === null) throw new Error("card or slot missing");
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: "move" } });
    fireEvent.drop(center, { dataTransfer: { getData: () => "1" } });
    expect(center.textContent).toContain("Empty");
  });

  it("asks for confirmation before removing a player and honors cancel", async () => {
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} />);
    const user = await searchFor("brunson");
    await user.click(screen.getByRole("button", { name: "Add Jalen Brunson" }));
    await user.click(screen.getByRole("button", { name: "Remove Jalen Brunson" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Remove Jalen Brunson?");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 15 slots filled")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Jalen Brunson" }));
    await user.click(screen.getByRole("button", { name: "Remove player" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("0 of 15 slots filled")).toBeInTheDocument();
  });

  it("saves edits to an existing team and returns to My Teams", async () => {
    const user = userEvent.setup();
    const existing = {
      id: "team-1",
      name: "Bench Mob",
      createdAt: "2026-07-23T00:00:00.000Z",
      slots: buildSlots({ counts: DEFAULT_SLOT_COUNTS }).map((slot) =>
        slot.id === "PG-1" ? { ...slot, player: players[0] ?? null } : slot,
      ),
    };
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} team={existing} />);
    expect(screen.getByLabelText("Team name")).toHaveValue("Bench Mob");
    expect(screen.getByText("1 of 15 slots filled")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search players"), "hart");
    await user.click(screen.getByRole("button", { name: "Add Josh Hart" }));
    await user.click(screen.getByRole("button", { name: "Save team" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/my-teams"));
    expect(saveLeagueTeamMock).toHaveBeenCalledWith(
      expect.objectContaining({ leagueId: LEAGUE_ID, teamId: "team-1", name: "Bench Mob" }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("saves a new named team and lands on My Teams", async () => {
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} />);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Save team" })).toBeDisabled();
    await user.type(screen.getByLabelText("Team name"), "Bench Mob");
    await user.type(screen.getByLabelText("Search players"), "hart");
    await user.click(screen.getByRole("button", { name: "Add Josh Hart" }));
    await user.click(screen.getByRole("button", { name: "Save team" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/my-teams"));
    expect(saveLeagueTeamMock).toHaveBeenCalledWith(
      expect.objectContaining({ leagueId: LEAGUE_ID, teamId: null, name: "Bench Mob" }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an inline alert when the save is invalid", async () => {
    saveLeagueTeamMock.mockResolvedValue({ status: "invalid" });
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Team name"), "Bench Mob");
    await user.click(screen.getByRole("button", { name: "Save team" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check the team name and roster.");
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a generic inline alert on any other failure", async () => {
    saveLeagueTeamMock.mockResolvedValue({ status: "error" });
    render(<TeamBuilder leagueId={LEAGUE_ID} players={players} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Team name"), "Bench Mob");
    await user.click(screen.getByRole("button", { name: "Save team" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong — try again.");
    expect(push).not.toHaveBeenCalled();
  });
});
