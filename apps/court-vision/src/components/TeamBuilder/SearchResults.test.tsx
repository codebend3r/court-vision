import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { SearchResults, type SearchResultsProps } from "@/components/TeamBuilder/SearchResults";
import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

afterEach(cleanup);

const player = (
  overrides: Partial<FantasyTeamPlayer> & { playerId: number; fullName: string },
): FantasyTeamPlayer => ({
  firstName: overrides.fullName.split(" ")[0] ?? "",
  lastName: overrides.fullName.split(" ")[1] ?? "",
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
  ...overrides,
});

const players = [
  player({ playerId: 1, fullName: "Jalen Brunson" }),
  player({ playerId: 2, fullName: "Josh Hart", position: "G-F" }),
  player({ playerId: 3, fullName: "Mikal Bridges", position: null }),
];

const renderResults = (overrides: Partial<SearchResultsProps> = {}) => {
  const props: SearchResultsProps = {
    query: "",
    players,
    rostered: new Set<number>(),
    openSlotFor: () => "PG-1",
    onAdd: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    ...overrides,
  };
  render(<SearchResults {...props} />);
  return props;
};

describe("SearchResults", () => {
  it("lists nobody until the search has two characters", () => {
    renderResults({ query: " j " });
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText(/No players match/)).not.toBeInTheDocument();
  });

  it("matches first, last or full names, case-insensitively", () => {
    renderResults({ query: "BRI" });
    expect(screen.getByText("Mikal Bridges")).toBeInTheDocument();
    expect(screen.queryByText("Jalen Brunson")).not.toBeInTheDocument();
  });

  it("says so when nobody matches", () => {
    renderResults({ query: " zz " });
    expect(screen.getByText("No players match “zz”.")).toBeInTheDocument();
  });

  it("adds a player from the + button, titled with the slot it fills", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    renderResults({ query: "brunson", onAdd });
    const add = screen.getByRole("button", { name: "Add Jalen Brunson" });
    expect(add).toHaveAttribute("title", "Add to PG-1");
    await user.click(add);
    expect(onAdd).toHaveBeenCalledWith({ player: players[0] });
  });

  it("disables + for a player already on the roster", () => {
    renderResults({ query: "jalen", rostered: new Set([1]) });
    expect(screen.getByRole("button", { name: "Add Jalen Brunson" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Jalen Brunson" })).toHaveAttribute(
      "title",
      "Already on the roster",
    );
  });

  it("disables + when no eligible slot is open", () => {
    renderResults({ query: "hart", openSlotFor: () => null });
    expect(screen.getByRole("button", { name: "Add Josh Hart" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Josh Hart" })).toHaveAttribute(
      "title",
      "No eligible open slot",
    );
  });

  it("starts and ends a drag with the card's player", () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    renderResults({ query: "hart", onDragStart, onDragEnd });
    const card = screen.getByRole("listitem");
    const setData = vi.fn();
    fireEvent.dragStart(card, { dataTransfer: { setData, effectAllowed: "none" } });
    expect(setData).toHaveBeenCalledWith("text/plain", "2");
    expect(onDragStart).toHaveBeenCalledWith({ player: players[1] });
    fireEvent.dragEnd(card);
    expect(onDragEnd).toHaveBeenCalled();
  });
});
