import type {
  FantasyTeamPlayer,
  RosterSlot,
  RosterSlotType,
  SlotCounts,
} from "@/lib/fantasyTeams/types";
import { parseEligibleGroups } from "@/lib/valuation/modifiers/positional";

export type SlotKind = "starter" | "bench" | "injured";

export type SlotMeta = {
  type: RosterSlotType;
  label: string;
  fullName: string;
  kind: SlotKind;
  max: number; // stepper ceiling on the create page
};

// Roster order: position slots, flex, utility, bench, injured list.
export const SLOT_META: readonly SlotMeta[] = [
  { type: "PG", label: "PG", fullName: "Point Guard", kind: "starter", max: 4 },
  { type: "SG", label: "SG", fullName: "Shooting Guard", kind: "starter", max: 4 },
  { type: "SF", label: "SF", fullName: "Small Forward", kind: "starter", max: 4 },
  { type: "PF", label: "PF", fullName: "Power Forward", kind: "starter", max: 4 },
  { type: "C", label: "C", fullName: "Center", kind: "starter", max: 4 },
  { type: "G", label: "G", fullName: "Guard", kind: "starter", max: 4 },
  { type: "F", label: "F", fullName: "Forward", kind: "starter", max: 4 },
  { type: "UTIL", label: "UTIL", fullName: "Utility", kind: "starter", max: 6 },
  { type: "BENCH", label: "BE", fullName: "Bench", kind: "bench", max: 10 },
  { type: "IL", label: "IL", fullName: "Injured List", kind: "injured", max: 4 },
  { type: "ILPLUS", label: "IL+", fullName: "Injured List Plus", kind: "injured", max: 4 },
];

export const SLOT_TYPES: readonly RosterSlotType[] = SLOT_META.map((meta) => meta.type);

export const slotMeta = (type: RosterSlotType): SlotMeta => {
  const meta = SLOT_META.find((entry) => entry.type === type);
  if (meta === undefined) throw new Error(`unknown slot type ${type}`);
  return meta;
};

// A standard 13-man roster plus injured slots.
export const DEFAULT_SLOT_COUNTS: SlotCounts = {
  PG: 1,
  SG: 1,
  SF: 1,
  PF: 1,
  C: 1,
  G: 1,
  F: 1,
  UTIL: 3,
  BENCH: 3,
  IL: 1,
  ILPLUS: 1,
};

export const clampSlotCount = ({
  type,
  value,
}: {
  type: RosterSlotType;
  value: number;
}): number => {
  if (!Number.isSafeInteger(value)) return DEFAULT_SLOT_COUNTS[type];
  return Math.min(slotMeta(type).max, Math.max(0, value));
};

export const rosterSize = ({ counts }: { counts: SlotCounts }): number =>
  SLOT_TYPES.reduce((sum, type) => sum + counts[type], 0);

// Which players can fill which slots. Balldontlie positions are coarse
// G/F/C groups, so PG/SG/G all accept guards, SF/PF/F accept forwards.
// UTIL, bench, and the injured slots accept anyone.
export const eligibleForSlot = ({
  slotType,
  position,
}: {
  slotType: RosterSlotType;
  position: string | null;
}): boolean => {
  if (slotType === "UTIL" || slotType === "BENCH" || slotType === "IL" || slotType === "ILPLUS") {
    return true;
  }
  const groups = parseEligibleGroups(position);
  if (slotType === "PG" || slotType === "SG" || slotType === "G") {
    return groups.some((group) => group === "G");
  }
  if (slotType === "SF" || slotType === "PF" || slotType === "F") {
    return groups.some((group) => group === "F");
  }
  return groups.some((group) => group === "C");
};

export const buildSlots = ({ counts }: { counts: SlotCounts }): RosterSlot[] =>
  SLOT_META.flatMap((meta) =>
    Array.from({ length: counts[meta.type] }, (_, index) => ({
      id: `${meta.type}-${index + 1}`,
      type: meta.type,
      player: null,
    })),
  );

// Rebuild the slot list for new counts, keeping each slot type's first N
// assigned players so shrinking a section drops from the end.
export const resizeSlots = ({
  slots,
  counts,
}: {
  slots: readonly RosterSlot[];
  counts: SlotCounts;
}): RosterSlot[] =>
  SLOT_META.flatMap((meta) => {
    const existing = slots.filter((slot) => slot.type === meta.type);
    return Array.from({ length: counts[meta.type] }, (_, index) => ({
      id: `${meta.type}-${index + 1}`,
      type: meta.type,
      player: existing[index]?.player ?? null,
    }));
  });

export const rosteredIds = ({ slots }: { slots: readonly RosterSlot[] }): Set<number> =>
  new Set(slots.flatMap((slot) => (slot.player === null ? [] : [slot.player.playerId])));

// Recover the settings-panel counts from a stored team's slot list.
export const countsFromSlots = ({ slots }: { slots: readonly RosterSlot[] }): SlotCounts =>
  SLOT_TYPES.reduce<SlotCounts>(
    (acc, type) => ({ ...acc, [type]: slots.filter((slot) => slot.type === type).length }),
    { PG: 0, SG: 0, SF: 0, PF: 0, C: 0, G: 0, F: 0, UTIL: 0, BENCH: 0, IL: 0, ILPLUS: 0 },
  );

// The + button's target: the first empty, eligible active-roster slot.
// Position slots fill before UTIL, UTIL before bench; injured slots are
// never auto-filled — a healthy pickup does not belong on the IL.
export const autoAssignSlotId = ({
  slots,
  player,
}: {
  slots: readonly RosterSlot[];
  player: FantasyTeamPlayer;
}): string | null => {
  if (rosteredIds({ slots }).has(player.playerId)) return null;
  const target = slots.find(
    (slot) =>
      slot.player === null &&
      slot.type !== "IL" &&
      slot.type !== "ILPLUS" &&
      eligibleForSlot({ slotType: slot.type, position: player.position }),
  );
  return target?.id ?? null;
};
