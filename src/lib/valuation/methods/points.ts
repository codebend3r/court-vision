import type { Basis, FantasyStatLine } from "@/lib/valuation/types";

// Points-League Linear (PRD §6.4): the dot product of the stat line with the
// league's scoring settings. No pool, no standardization. These defaults are
// the PRD's example table; user-supplied scoring arrives in a later phase.
export const DEFAULT_POINTS_SCORING: Record<"pts" | "reb" | "ast" | "stl" | "blk" | "tov", number> =
  {
    pts: 1,
    reb: 1.2,
    ast: 1.5,
    stl: 3,
    blk: 3,
    tov: -1,
  };

const SCORED_KEYS = ["pts", "reb", "ast", "stl", "blk", "tov"] as const;

export const scorePoints = ({
  lines,
  basis,
}: {
  lines: readonly FantasyStatLine[];
  basis: Basis;
}): Array<{ playerId: number; total: number }> =>
  lines.map((line) => {
    const raw = SCORED_KEYS.reduce((sum, key) => sum + line[key] * DEFAULT_POINTS_SCORING[key], 0);
    const total = basis === "total" ? raw : line.gamesPlayed > 0 ? raw / line.gamesPlayed : 0;
    return { playerId: line.playerId, total };
  });
