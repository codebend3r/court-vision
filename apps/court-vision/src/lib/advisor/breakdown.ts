import { type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";

import { type BreakdownFor } from "@/lib/advisor/needs";
import { type FantasyStatLine } from "@/lib/valuation/types";

type LineBreakdownProps = { line: FantasyStatLine };

// The advisor engine's category reader over a valued pool: each player's
// breakdown worked out once, on first ask, since ranking the league and
// matching trades ask for the same player many times. An unknown player reads
// as no categories.
type CachedBreakdownForProps = {
  lines: readonly FantasyStatLine[];
  lineBreakdown: ({ line }: LineBreakdownProps) => FantasyCategoryBreakdown[];
};

export const cachedBreakdownFor = ({
  lines,
  lineBreakdown,
}: CachedBreakdownForProps): BreakdownFor => {
  const lineById = new Map(lines.map((line) => [line.playerId, line]));
  const cache = new Map<number, FantasyCategoryBreakdown[]>();
  return ({ playerId }) => {
    const cached = cache.get(playerId);
    if (cached !== undefined) return cached;
    const line = lineById.get(playerId);
    const breakdown = line === undefined ? [] : lineBreakdown({ line });
    cache.set(playerId, breakdown);
    return breakdown;
  };
};
