import { replacementLevel } from "@/lib/valuation/modifiers/replacement";

export type PositionGroup = "G" | "F" | "C";

// v1 slot structure for a standard roster: roughly four guard slots, four
// forward slots, and two center slots per team (PRD §6.7 — refined when real
// platform slot structures land).
export const DEFAULT_GROUP_SLOTS: Record<PositionGroup, number> = { G: 4, F: 4, C: 2 };

const isPositionGroup = (value: string): value is PositionGroup =>
  value === "G" || value === "F" || value === "C";

// Balldontlie positions are "G", "F-C", "G-F", … — split on the hyphen and
// keep the recognized groups.
export const parseEligibleGroups = (position: string | null): PositionGroup[] =>
  (position ?? "")
    .split("-")
    .map((part) => part.trim().toUpperCase())
    .filter(isPositionGroup)
    .filter((group, index, groups) => groups.indexOf(group) === index);

// Positional scarcity as a replacement premium (PRD §6.7 variant 2): keep the
// global base value, subtract a per-position replacement level. A player
// eligible at several slots is valued at the slot that maximizes their value
// — the eligible position with the LOWEST replacement level. Players with no
// parseable position fall back to the global replacement level.
export const positionalValues = ({
  players,
  teams,
  fallbackReplacement,
}: {
  players: readonly { playerId: number; total: number; position: string | null }[];
  teams: number;
  fallbackReplacement: number;
}): Map<number, number> => {
  const groups: readonly PositionGroup[] = ["G", "F", "C"];
  const levelByGroup = groups.reduce<Partial<Record<PositionGroup, number>>>((acc, group) => {
    const eligible = players.filter((player) =>
      parseEligibleGroups(player.position).some((candidate) => candidate === group),
    );
    if (eligible.length === 0) return acc;
    return {
      ...acc,
      [group]: replacementLevel({ totals: eligible, rank: teams * DEFAULT_GROUP_SLOTS[group] }),
    };
  }, {});
  return new Map(
    players.map((player) => {
      const levels = parseEligibleGroups(player.position)
        .map((group) => levelByGroup[group])
        .filter((level): level is number => level !== undefined);
      const replacement = levels.length > 0 ? Math.min(...levels) : fallbackReplacement;
      return [player.playerId, player.total - replacement];
    }),
  );
};
