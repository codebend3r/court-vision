import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { replacementLevel } from "#core/valuation/modifiers/replacement";

// Positional scarcity as a replacement premium (PRD §6.7 variant 2): keep the
// global base value, subtract a per-position replacement level. A player
// eligible at several groups is valued at the group that maximizes their
// value — the eligible group with the LOWEST replacement level. Each group's
// replacement sits at rank teams × the sport's replacement slots for it.
// Players with no parseable position fall back to the global replacement
// level.
type PositionalValuesProps<K extends SportKeys> = {
  sport: SportDescriptor<K>;
  players: readonly { playerId: number; total: number; position: string | null }[];
  teams: number;
  fallbackReplacement: number;
};

type ReplacementForProps = { position: string | null };

// The replacement level a player at `position` is measured against, from the
// pool's levels by group: built once, then read for any player (a pool row or
// a rolling window carrying that player's position).
export const positionalReplacement = <K extends SportKeys>({
  sport,
  players,
  teams,
  fallbackReplacement,
}: PositionalValuesProps<K>) => {
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
  return ({ position }: ReplacementForProps): number => {
    const levels = parse(position)
      .map((group) => levelByGroup[group])
      .filter((level): level is number => level !== undefined);
    return levels.length > 0 ? Math.min(...levels) : fallbackReplacement;
  };
};

export const positionalValues = <K extends SportKeys>(
  args: PositionalValuesProps<K>,
): Map<number, number> => {
  const replacementFor = positionalReplacement(args);
  return new Map(
    args.players.map((player) => [
      player.playerId,
      player.total - replacementFor({ position: player.position }),
    ]),
  );
};
