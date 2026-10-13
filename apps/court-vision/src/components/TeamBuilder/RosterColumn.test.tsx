import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { RosterColumn, type RosterColumnProps } from "@/components/TeamBuilder/RosterColumn";
import { buildSlots, DEFAULT_SLOT_COUNTS } from "@vision/sport-basketball/engine";
import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

afterEach(cleanup);

const brunson: FantasyTeamPlayer = {
  playerId: 1,
  firstName: "Jalen",
  lastName: "Brunson",
  fullName: "Jalen Brunson",
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
};

const slots = buildSlots<FantasyTeamPlayer>({ counts: DEFAULT_SLOT_COUNTS }).map((slot) =>
  slot.id === "PG-1" ? { ...slot, player: brunson } : slot,
);

const renderColumn = (overrides: Partial<RosterColumnProps> = {}) => {
  const props: RosterColumnProps = {
    slots,
    dragging: null,
    canDrop: () => true,
    onDrop: vi.fn(),
    onHover: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<RosterColumn {...props} />);
  return props;
};

describe("RosterColumn", () => {
  it("heads each slot section with its title", () => {
    renderColumn();
    const roster = screen.getByRole("region", { name: "Roster" });
    expect(
      within(roster)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Starters", "Bench", "Injured list"]);
  });

  it("links a filled slot's player and offers to remove them", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    renderColumn({ onRemove });
    expect(screen.getByRole("link", { name: "View Jalen Brunson's profile" })).toHaveAttribute(
      "href",
      "/players/1",
    );
    await user.click(screen.getByRole("button", { name: "Remove Jalen Brunson" }));
    expect(onRemove).toHaveBeenCalledWith({
      slot: expect.objectContaining({ id: "PG-1", type: "PG" }),
      player: brunson,
    });
  });

  it("reports the hovered player for the quick look", () => {
    const onHover = vi.fn();
    renderColumn({ onHover });
    const link = screen.getByRole("link", { name: "View Jalen Brunson's profile" });
    const row = link.closest("li");
    if (row === null) throw new Error("slot row missing");
    fireEvent.mouseEnter(row);
    expect(onHover).toHaveBeenCalledWith({ player: brunson });
  });

  it("marks every slot as a legal or refused landing spot during a drag", () => {
    renderColumn({
      dragging: brunson,
      canDrop: ({ slot }) => slot.type !== "C",
    });
    expect(document.querySelector('[data-slot-id="SG-1"]')).toHaveAttribute("data-drop", "ok");
    expect(document.querySelector('[data-slot-id="C-1"]')).toHaveAttribute("data-drop", "no");
  });

  it("hands a drop's player id to the builder", () => {
    const onDrop = vi.fn();
    renderColumn({ onDrop });
    const target = document.querySelector('[data-slot-id="G-1"]');
    if (target === null) throw new Error("slot missing");
    fireEvent.drop(target, { dataTransfer: { getData: () => "7" } });
    expect(onDrop).toHaveBeenCalledWith({
      slot: expect.objectContaining({ id: "G-1" }),
      playerId: 7,
    });
  });
});
