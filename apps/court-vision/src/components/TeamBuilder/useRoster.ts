import { useMemo, useState } from "react";

import {
  autoAssignSlotId,
  buildSlots,
  clampSlotCount,
  countsFromSlots,
  DEFAULT_SLOT_COUNTS,
  eligibleForSlot,
  resizeSlots,
} from "@vision/sport-basketball/engine";
import { rosteredIds } from "@vision/core/roster/slots";
import {
  type FantasyTeam,
  type FantasyTeamPlayer,
  type RosterSlot,
  type RosterSlotType,
  type SlotCounts,
} from "@/lib/fantasyTeams/types";

export type Roster = {
  counts: SlotCounts;
  slots: RosterSlot[];
  rostered: ReadonlySet<number>;
  // An empty slot the player is eligible for, and not already rostered.
  canDrop: (args: { slot: RosterSlot; player: FantasyTeamPlayer }) => boolean;
  // The slot the + button would fill, or null when none is open.
  openSlotFor: (args: { player: FantasyTeamPlayer }) => string | null;
  assign: (args: { slotId: string; player: FantasyTeamPlayer }) => void;
  add: (args: { player: FantasyTeamPlayer }) => void;
  clearSlot: (args: { slotId: string }) => void;
  // Resizes one slot type from its stepper's raw value, keeping each type's
  // first N players.
  setCount: (args: { type: RosterSlotType; raw: string }) => void;
};

// The builder's roster: the slot counts and the slots they produce, seeded
// from the team being edited (or the default shape for a new one).
export const useRoster = ({ team }: { team: FantasyTeam | null }): Roster => {
  const [counts, setCounts] = useState<SlotCounts>(() =>
    team === null ? DEFAULT_SLOT_COUNTS : countsFromSlots({ slots: team.slots }),
  );
  const [slots, setSlots] = useState<RosterSlot[]>(() =>
    team === null ? buildSlots({ counts: DEFAULT_SLOT_COUNTS }) : team.slots,
  );

  const rostered = useMemo(() => rosteredIds({ slots }), [slots]);

  const canDrop: Roster["canDrop"] = ({ slot, player }) =>
    slot.player === null &&
    !rostered.has(player.playerId) &&
    eligibleForSlot({ slotType: slot.type, position: player.position });

  const openSlotFor: Roster["openSlotFor"] = ({ player }) => autoAssignSlotId({ slots, player });

  // Re-checks against the latest slots, so two quick adds can never land the
  // same player twice or overwrite a slot filled in between.
  const assign: Roster["assign"] = ({ slotId, player }) => {
    setSlots((current) =>
      current.map((slot) =>
        slot.id === slotId &&
        slot.player === null &&
        !rosteredIds({ slots: current }).has(player.playerId) &&
        eligibleForSlot({ slotType: slot.type, position: player.position })
          ? { ...slot, player }
          : slot,
      ),
    );
  };

  const add: Roster["add"] = ({ player }) => {
    const slotId = openSlotFor({ player });
    if (slotId !== null) assign({ slotId, player });
  };

  const clearSlot: Roster["clearSlot"] = ({ slotId }) => {
    setSlots((current) =>
      current.map((slot) => (slot.id === slotId ? { ...slot, player: null } : slot)),
    );
  };

  const setCount: Roster["setCount"] = ({ type, raw }) => {
    const next = { ...counts, [type]: clampSlotCount({ type, value: Number.parseInt(raw, 10) }) };
    setCounts(next);
    setSlots((current) => resizeSlots({ slots: current, counts: next }));
  };

  return { counts, slots, rostered, canDrop, openSlotFor, assign, add, clearSlot, setCount };
};
