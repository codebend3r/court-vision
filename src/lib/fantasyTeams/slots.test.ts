import { describe, expect, it } from "vitest";

import {
  autoAssignSlotId,
  buildSlots,
  clampSlotCount,
  countsFromSlots,
  DEFAULT_SLOT_COUNTS,
  eligibleForSlot,
  resizeSlots,
  rosterSize,
  rosteredIds,
  SLOT_TYPES,
} from "@/lib/fantasyTeams/slots";
import { type FantasyTeamPlayer, type SlotCounts } from "@/lib/fantasyTeams/types";

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

describe("slot configuration", () => {
  it("defaults to a 13-man roster plus two injured slots", () => {
    expect(rosterSize({ counts: DEFAULT_SLOT_COUNTS })).toBe(15);
    expect(DEFAULT_SLOT_COUNTS.IL).toBe(1);
    expect(DEFAULT_SLOT_COUNTS.ILPLUS).toBe(1);
  });

  it("clamps stepper values to each slot's range", () => {
    expect(clampSlotCount({ type: "PG", value: 99 })).toBe(4);
    expect(clampSlotCount({ type: "BENCH", value: 99 })).toBe(10);
    expect(clampSlotCount({ type: "PG", value: -1 })).toBe(0);
    expect(clampSlotCount({ type: "PG", value: Number.NaN })).toBe(DEFAULT_SLOT_COUNTS.PG);
  });
});

describe("eligibleForSlot", () => {
  it("maps position groups onto slots", () => {
    expect(eligibleForSlot({ slotType: "PG", position: "G" })).toBe(true);
    expect(eligibleForSlot({ slotType: "SG", position: "G-F" })).toBe(true);
    expect(eligibleForSlot({ slotType: "C", position: "G" })).toBe(false);
    expect(eligibleForSlot({ slotType: "PF", position: "F-C" })).toBe(true);
    expect(eligibleForSlot({ slotType: "C", position: "F-C" })).toBe(true);
    expect(eligibleForSlot({ slotType: "G", position: "C" })).toBe(false);
  });

  it("lets anyone fill UTIL, bench, and injured slots", () => {
    expect(eligibleForSlot({ slotType: "UTIL", position: "C" })).toBe(true);
    expect(eligibleForSlot({ slotType: "BENCH", position: null })).toBe(true);
    expect(eligibleForSlot({ slotType: "IL", position: "G" })).toBe(true);
    expect(eligibleForSlot({ slotType: "ILPLUS", position: null })).toBe(true);
  });
});

describe("buildSlots / resizeSlots", () => {
  it("builds slots in roster order with stable ids", () => {
    const slots = buildSlots({ counts: DEFAULT_SLOT_COUNTS });
    expect(slots).toHaveLength(15);
    expect(slots[0]?.id).toBe("PG-1");
    expect(slots.filter((slot) => slot.type === "UTIL")).toHaveLength(3);
    expect(SLOT_TYPES.indexOf(slots[14]?.type ?? "PG")).toBeGreaterThan(0);
  });

  it("preserves assigned players when counts change, dropping from the end", () => {
    const counts: SlotCounts = { ...DEFAULT_SLOT_COUNTS, BENCH: 2 };
    const slots = buildSlots({ counts }).map((slot) =>
      slot.id === "BENCH-1"
        ? { ...slot, player: player({ playerId: 1 }) }
        : slot.id === "BENCH-2"
          ? { ...slot, player: player({ playerId: 2 }) }
          : slot,
    );
    const shrunk = resizeSlots({ slots, counts: { ...counts, BENCH: 1 } });
    expect(shrunk.filter((slot) => slot.type === "BENCH")).toHaveLength(1);
    expect(shrunk.find((slot) => slot.id === "BENCH-1")?.player?.playerId).toBe(1);
    const grown = resizeSlots({ slots, counts: { ...counts, BENCH: 4 } });
    expect(grown.filter((slot) => slot.type === "BENCH")).toHaveLength(4);
    expect(grown.find((slot) => slot.id === "BENCH-2")?.player?.playerId).toBe(2);
    expect(grown.find((slot) => slot.id === "BENCH-4")?.player).toBeNull();
  });
});

describe("countsFromSlots", () => {
  it("recovers the settings counts from a stored slot list", () => {
    const slots = buildSlots({ counts: { ...DEFAULT_SLOT_COUNTS, BENCH: 5, C: 2 } });
    const counts = countsFromSlots({ slots });
    expect(counts.BENCH).toBe(5);
    expect(counts.C).toBe(2);
    expect(counts.PG).toBe(1);
    expect(rosterSize({ counts })).toBe(slots.length);
  });
});

describe("autoAssignSlotId", () => {
  it("fills position slots before UTIL and UTIL before bench, never the IL", () => {
    const slots = buildSlots({ counts: DEFAULT_SLOT_COUNTS });
    const guard = player({ playerId: 1, position: "G" });
    expect(autoAssignSlotId({ slots, player: guard })).toBe("PG-1");
    const withPg = slots.map((slot) =>
      slot.id === "PG-1" ? { ...slot, player: player({ playerId: 9 }) } : slot,
    );
    expect(autoAssignSlotId({ slots: withPg, player: guard })).toBe("SG-1");
    const center = player({ playerId: 2, position: "C" });
    const centerFull = slots.map((slot) =>
      slot.type === "C" ? { ...slot, player: player({ playerId: 8, position: "C" }) } : slot,
    );
    expect(autoAssignSlotId({ slots: centerFull, player: center })).toBe("UTIL-1");
    const activeFull = slots.map((slot) =>
      slot.type === "IL" || slot.type === "ILPLUS"
        ? slot
        : { ...slot, player: player({ playerId: 100 + Number(slot.id.length) }) },
    );
    expect(autoAssignSlotId({ slots: activeFull, player: player({ playerId: 3 }) })).toBeNull();
  });

  it("refuses players already on the roster", () => {
    const slots = buildSlots({ counts: DEFAULT_SLOT_COUNTS }).map((slot) =>
      slot.id === "UTIL-1" ? { ...slot, player: player({ playerId: 7 }) } : slot,
    );
    expect(autoAssignSlotId({ slots, player: player({ playerId: 7 }) })).toBeNull();
    expect(rosteredIds({ slots }).has(7)).toBe(true);
  });
});
