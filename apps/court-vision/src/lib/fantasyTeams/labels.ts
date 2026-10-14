import { type SlotKind } from "@vision/core/sport/types";

// The heading over each roster section (see groupSlotsByKind), shared by the
// team builder and the My Teams list.
export const SLOT_KIND_TITLES: Record<SlotKind, string> = {
  starter: "Starters",
  bench: "Bench",
  injured: "Injured list",
};
