import { type SlotDef, type SportDescriptor, type SportKeys } from "#core/sport/types";
import { recordFromKeys } from "#core/util/record";

// The least a roster needs to know about a player: who, and where they play.
export type RosterPlayer = { playerId: number; position: string | null };

export type RosterSlot<K extends SportKeys, P extends RosterPlayer> = {
  id: string; // unique within a team, e.g. "UTIL-2"
  type: K["slot"];
  player: P | null;
};

export type SlotCounts<K extends SportKeys> = Record<K["slot"], number>;

export const slotTypes = <K extends SportKeys>({
  sport,
}: {
  sport: SportDescriptor<K>;
}): K["slot"][] => sport.slots.map((slot) => slot.type);

export const slotMeta = <K extends SportKeys>({
  sport,
  type,
}: {
  sport: SportDescriptor<K>;
  type: K["slot"];
}): SlotDef<K> => {
  const meta = sport.slots.find((entry) => entry.type === type);
  if (meta === undefined) throw new Error(`${sport.id} has no slot type ${type}`);
  return meta;
};

export const defaultSlotCounts = <K extends SportKeys>({
  sport,
}: {
  sport: SportDescriptor<K>;
}): SlotCounts<K> =>
  recordFromKeys({
    keys: slotTypes({ sport }),
    value: (type) => slotMeta({ sport, type }).defaultCount,
  });

export const clampSlotCount = <K extends SportKeys>({
  sport,
  type,
  value,
}: {
  sport: SportDescriptor<K>;
  type: K["slot"];
  value: number;
}): number => {
  const meta = slotMeta({ sport, type });
  if (!Number.isSafeInteger(value)) return meta.defaultCount;
  return Math.min(meta.max, Math.max(0, value));
};

export const rosterSize = <K extends SportKeys>({
  sport,
  counts,
}: {
  sport: SportDescriptor<K>;
  counts: SlotCounts<K>;
}): number => slotTypes({ sport }).reduce((sum, type) => sum + counts[type], 0);

// Which players can fill which slots: a slot names the position groups it
// accepts (PG takes guards), or takes anyone (UTIL, bench, injured list).
export const eligibleForSlot = <K extends SportKeys>({
  sport,
  slotType,
  position,
}: {
  sport: SportDescriptor<K>;
  slotType: K["slot"];
  position: string | null;
}): boolean => {
  const { accepts } = slotMeta({ sport, type: slotType });
  if (accepts === "any") return true;
  const groups = sport.positions.parse(position);
  return groups.some((group) => accepts.some((accepted) => accepted === group));
};

export const buildSlots = <K extends SportKeys, P extends RosterPlayer>({
  sport,
  counts,
}: {
  sport: SportDescriptor<K>;
  counts: SlotCounts<K>;
}): RosterSlot<K, P>[] =>
  sport.slots.flatMap((meta) =>
    Array.from({ length: counts[meta.type] }, (_, index) => ({
      id: `${meta.type}-${index + 1}`,
      type: meta.type,
      player: null,
    })),
  );

// Rebuild the slot list for new counts, keeping each slot type's first N
// assigned players so shrinking a section drops from the end.
export const resizeSlots = <K extends SportKeys, P extends RosterPlayer>({
  sport,
  slots,
  counts,
}: {
  sport: SportDescriptor<K>;
  slots: readonly RosterSlot<K, P>[];
  counts: SlotCounts<K>;
}): RosterSlot<K, P>[] =>
  sport.slots.flatMap((meta) => {
    const existing = slots.filter((slot) => slot.type === meta.type);
    return Array.from({ length: counts[meta.type] }, (_, index) => ({
      id: `${meta.type}-${index + 1}`,
      type: meta.type,
      player: existing[index]?.player ?? null,
    }));
  });

export const rosteredIds = <K extends SportKeys, P extends RosterPlayer>({
  slots,
}: {
  slots: readonly RosterSlot<K, P>[];
}): Set<number> =>
  new Set(slots.flatMap((slot) => (slot.player === null ? [] : [slot.player.playerId])));

// Recover the settings-panel counts from a stored team's slot list.
export const countsFromSlots = <K extends SportKeys, P extends RosterPlayer>({
  sport,
  slots,
}: {
  sport: SportDescriptor<K>;
  slots: readonly RosterSlot<K, P>[];
}): SlotCounts<K> =>
  recordFromKeys({
    keys: slotTypes({ sport }),
    value: (type) => slots.filter((slot) => slot.type === type).length,
  });

// The + button's target: the first empty, eligible active-roster slot.
// Position slots fill before UTIL, UTIL before bench; injured slots are
// never auto-filled — a healthy pickup does not belong on the IL.
export const autoAssignSlotId = <K extends SportKeys, P extends RosterPlayer>({
  sport,
  slots,
  player,
}: {
  sport: SportDescriptor<K>;
  slots: readonly RosterSlot<K, P>[];
  player: P;
}): string | null => {
  if (rosteredIds({ slots }).has(player.playerId)) return null;
  const target = slots.find(
    (slot) =>
      slot.player === null &&
      slotMeta({ sport, type: slot.type }).kind !== "injured" &&
      eligibleForSlot({ sport, slotType: slot.type, position: player.position }),
  );
  return target?.id ?? null;
};
