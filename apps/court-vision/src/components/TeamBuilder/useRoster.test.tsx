import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "bun:test";

import { useRoster } from "@/components/TeamBuilder/useRoster";
import { buildSlots, DEFAULT_SLOT_COUNTS } from "@vision/sport-basketball/engine";
import { type FantasyTeam, type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

afterEach(cleanup);

const guard: FantasyTeamPlayer = {
  playerId: 1,
  firstName: "Jalen",
  lastName: "Brunson",
  fullName: "Jalen Brunson",
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
};

const center: FantasyTeamPlayer = { ...guard, playerId: 2, fullName: "Mitchell Robinson" };

type HarnessProps = { team: FantasyTeam | null };

function Harness({ team }: HarnessProps) {
  const roster = useRoster({ team });
  const pg = roster.slots.find((slot) => slot.id === "PG-1");
  const c = roster.slots.find((slot) => slot.id === "C-1");
  return (
    <section>
      <output aria-label="filled">
        {roster.slots.filter((slot) => slot.player !== null).length}/{roster.slots.length}
      </output>
      <output aria-label="pg">{pg?.player?.fullName ?? "empty"}</output>
      <output aria-label="can drop guard on C">
        {String(c !== undefined && roster.canDrop({ slot: c, player: guard }))}
      </output>
      <output aria-label="open slot">{roster.openSlotFor({ player: guard }) ?? "none"}</output>
      <button type="button" onClick={() => roster.add({ player: guard })}>
        Add guard
      </button>
      <button type="button" onClick={() => roster.assign({ slotId: "C-1", player: center })}>
        Assign center to C
      </button>
      <button type="button" onClick={() => roster.clearSlot({ slotId: "PG-1" })}>
        Clear PG
      </button>
      <button type="button" onClick={() => roster.setCount({ type: "BENCH", raw: "5" })}>
        Five bench
      </button>
      <button type="button" onClick={() => roster.setCount({ type: "BENCH", raw: "" })}>
        Clear bench
      </button>
    </section>
  );
}

const read = (name: string): string => screen.getByRole("status", { name }).textContent ?? "";

describe("useRoster", () => {
  it("starts a new team on the default 15-slot shape", () => {
    render(<Harness team={null} />);
    expect(read("filled")).toBe("0/15");
    expect(read("open slot")).toBe("PG-1");
  });

  it("seeds an existing team's slots and counts", () => {
    const team: FantasyTeam = {
      id: "team-1",
      name: "Bench Mob",
      slug: "bench-mob",
      logoUrl: null,
      managerName: null,
      isMine: false,
      isImported: false,
      unmatchedBySlotId: {},
      createdAt: "2026-07-23T00:00:00.000Z",
      slots: buildSlots<FantasyTeamPlayer>({ counts: { ...DEFAULT_SLOT_COUNTS, BENCH: 1 } }).map(
        (slot) => (slot.id === "PG-1" ? { ...slot, player: guard } : slot),
      ),
    };
    render(<Harness team={team} />);
    expect(read("filled")).toBe(`1/${team.slots.length}`);
    expect(read("pg")).toBe("Jalen Brunson");
  });

  it("adds a player to the first open eligible slot, once", async () => {
    const user = userEvent.setup();
    render(<Harness team={null} />);
    await user.click(screen.getByRole("button", { name: "Add guard" }));
    await user.click(screen.getByRole("button", { name: "Add guard" }));
    expect(read("pg")).toBe("Jalen Brunson");
    expect(read("filled")).toBe("1/15");
    expect(read("open slot")).toBe("none");
  });

  it("refuses a slot the player is not eligible for", () => {
    render(<Harness team={null} />);
    expect(read("can drop guard on C")).toBe("false");
  });

  it("clears a slot", async () => {
    const user = userEvent.setup();
    render(<Harness team={null} />);
    await user.click(screen.getByRole("button", { name: "Add guard" }));
    await user.click(screen.getByRole("button", { name: "Clear PG" }));
    expect(read("pg")).toBe("empty");
  });

  it("resizes a slot type from its stepper, falling back to the default when cleared", async () => {
    const user = userEvent.setup();
    render(<Harness team={null} />);
    await user.click(screen.getByRole("button", { name: "Five bench" }));
    expect(read("filled")).toBe("0/17");
    await user.click(screen.getByRole("button", { name: "Clear bench" }));
    expect(read("filled")).toBe("0/15");
  });
});
