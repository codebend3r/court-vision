import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { replacementLevel } from "#core/valuation/modifiers/replacement";

// Positional scarcity as a replacement premium (PRD §6.7 variant 2): keep the
// global base value, subtract a per-position replacement level. A player
// eligible at several groups is valued at the group that maximizes their
// value — the eligible group with the LOWEST replacement level. Each group's
// replacement sits at rank teams × the sport's replacement slots for it.
// Players with no parseable position fall back to the global replacement
// level.
export const positionalValues = <K extends SportKeys>({
  sport,
  players,
  teams,
  fallbackReplacement,
}: {
  sport: SportDescriptor<K>;
  players: readonly { playerId: number; total: number; position: string | null }[];
  teams: number;
  fallbackReplacement: number;
}): Map<number, number> => {
  const { groups, parse, replacementSlots } = sport.positions;
  const levelByGroup = groups.reduce<Partial<Record<K["group"], number>>>((acc, group) => {
    const eligible = players.filter((player) =>
      parse(player.position).some((candidate) => candidate === group),
    );
    if (eligible.length === 0) return acc;
    return {
      ...acc,
      [group]: replacementLevel({ totals: eligible, rank: teams * replacementSlots[group] }),
    };
  }, {});
  return new Map(
    players.map((player) => {
      const levels = parse(player.position)
        .map((group) => levelByGroup[group])
        .filter((level): level is number => level !== undefined);
      const replacement = levels.length > 0 ? Math.min(...levels) : fallbackReplacement;
      return [player.playerId, player.total - replacement];
    }),
  );
};
