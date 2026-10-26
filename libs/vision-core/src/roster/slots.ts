import {
  type SlotDef,
  type SlotKind,
  type SportDescriptor,
  type SportKeys,
} from "#core/sport/types";
import { recordFromKeys } from "#core/util/record";

// The least a roster needs to know about a player: who, and where they play.
export type RosterPlayer = { playerId: number; position: string | null };

export type RosterSlot<K extends SportKeys, P extends RosterPlayer> = {
  id: string; // unique within a team, e.g. "UTIL-2"
  type: K["slot"];
  player: P | null;
};

export type SlotCounts<K extends SportKeys> = Record<K["slot"], number>;

type SlotTypesProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
};

export const slotTypes = <K extends SportKeys>({ sport }: SlotTypesProps<K>): K["slot"][] =>
  sport.slots.map((slot) => slot.type);

type SlotMetaProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  type: K["slot"];
};

export const slotMeta = <K extends SportKeys>({ sport, type }: SlotMetaProps<K>): SlotDef<K> => {
  const meta = sport.slots.find((entry) => entry.type === type);
  if (meta === undefined) throw new Error(`${sport.id} has no slot type ${type}`);
  return meta;
};

type DefaultSlotCountsProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
};

export const defaultSlotCounts = <K extends SportKeys>({
  sport,
}: DefaultSlotCountsProps<K>): SlotCounts<K> =>
  recordFromKeys({
    keys: slotTypes({ sport }),
    value: (type) => slotMeta({ sport, type }).defaultCount,
  });

type ClampSlotCountProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  type: K["slot"];
  value: number;
};

export const clampSlotCount = <K extends SportKeys>({
  sport,
  type,
  value,
}: ClampSlotCountProps<K>): number => {
  const meta = slotMeta({ sport, type });
  if (!Number.isSafeInteger(value)) return meta.defaultCount;
  return Math.min(meta.max, Math.max(0, value));
};

type RosterSizeProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  counts: SlotCounts<K>;
};

export const rosterSize = <K extends SportKeys>({ sport, counts }: RosterSizeProps<K>): number =>
  slotTypes({ sport }).reduce((sum, type) => sum + counts[type], 0);

// Which players can fill which slots: a slot names the position groups it
// accepts (PG takes guards), or takes anyone (UTIL, bench, injured list).
type EligibleForSlotProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  slotType: K["slot"];
  position: string | null;
};

export const eligibleForSlot = <K extends SportKeys>({
  sport,
  slotType,
  position,
}: EligibleForSlotProps<K>): boolean => {
  const { accepts } = slotMeta({ sport, type: slotType });
  if (accepts === "any") return true;
  const groups = sport.positions.parse(position);
  return groups.some((group) => accepts.some((accepted) => accepted === group));
};

type BuildSlotsProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  counts: SlotCounts<K>;
};

export const buildSlots = <K extends SportKeys, P extends RosterPlayer>({
  sport,
  counts,
}: BuildSlotsProps<K>): RosterSlot<K, P>[] =>
  sport.slots.flatMap((meta) =>
    Array.from({ length: counts[meta.type] }, (_, index) => ({
      id: `${meta.type}-${index + 1}`,
      type: meta.type,
      player: null,
    })),
  );

// Rebuild the slot list for new counts, keeping each slot type's first N
// assigned players so shrinking a section drops from the end.
type ResizeSlotsProps<P extends RosterPlayer, K extends SportKeys> = {
  sport: SportDescriptor<K>;
  slots: readonly RosterSlot<K, P>[];
  counts: SlotCounts<K>;
};

export const resizeSlots = <K extends SportKeys, P extends RosterPlayer>({
  sport,
  slots,
  counts,
}: ResizeSlotsProps<P, K>): RosterSlot<K, P>[] =>
  sport.slots.flatMap((meta) => {
    const existing = slots.filter((slot) => slot.type === meta.type);
    return Array.from({ length: counts[meta.type] }, (_, index) => ({
      id: `${meta.type}-${index + 1}`,
      type: meta.type,
      player: existing[index]?.player ?? null,
    }));
  });

// The order a roster reads in: starters, then bench, then the injured list.
export const SLOT_KINDS: readonly SlotKind[] = ["starter", "bench", "injured"];

export type SlotGroup<K extends SportKeys, P extends RosterPlayer> = {
  kind: SlotKind;
  slots: RosterSlot<K, P>[];
};

// A roster split into its sections, in reading order, keeping each slot's
// own order. A kind the roster has no slots of is left out, so the reader
// never sees an empty heading.
type GroupSlotsByKindProps<P extends RosterPlayer, K extends SportKeys> = {
  sport: SportDescriptor<K>;
  slots: readonly RosterSlot<K, P>[];
};

export const groupSlotsByKind = <K extends SportKeys, P extends RosterPlayer>({
  sport,
  slots,
}: GroupSlotsByKindProps<P, K>): SlotGroup<K, P>[] =>
  SLOT_KINDS.flatMap((kind) => {
    const kindSlots = slots.filter((slot) => slotMeta({ sport, type: slot.type }).kind === kind);
    return kindSlots.length === 0 ? [] : [{ kind, slots: kindSlots }];
  });

type RosteredIdsProps<P extends RosterPlayer, K extends SportKeys> = {
  slots: readonly RosterSlot<K, P>[];
};

export const rosteredIds = <K extends SportKeys, P extends RosterPlayer>({
  slots,
}: RosteredIdsProps<P, K>): Set<number> =>
  new Set(slots.flatMap((slot) => (slot.player === null ? [] : [slot.player.playerId])));

// Recover the settings-panel counts from a stored team's slot list.
type CountsFromSlotsProps<P extends RosterPlayer, K extends SportKeys> = {
  sport: SportDescriptor<K>;
  slots: readonly RosterSlot<K, P>[];
};

export const countsFromSlots = <K extends SportKeys, P extends RosterPlayer>({
  sport,
  slots,
}: CountsFromSlotsProps<P, K>): SlotCounts<K> =>
  recordFromKeys({
    keys: slotTypes({ sport }),
    value: (type) => slots.filter((slot) => slot.type === type).length,
  });

// The + button's target: the first empty, eligible active-roster slot.
// Position slots fill before UTIL, UTIL before bench; injured slots are
// never auto-filled — a healthy pickup does not belong on the IL.
type AutoAssignSlotIdProps<P extends RosterPlayer, K extends SportKeys> = {
  sport: SportDescriptor<K>;
  slots: readonly RosterSlot<K, P>[];
  player: P;
};

export const autoAssignSlotId = <K extends SportKeys, P extends RosterPlayer>({
  sport,
  slots,
  player,
}: AutoAssignSlotIdProps<P, K>): string | null => {
  if (rosteredIds({ slots }).has(player.playerId)) return null;
  const target = slots.find(
    (slot) =>
      slot.player === null &&
      slotMeta({ sport, type: slot.type }).kind !== "injured" &&
      eligibleForSlot({ sport, slotType: slot.type, position: player.position }),
  );
  return target?.id ?? null;
};
