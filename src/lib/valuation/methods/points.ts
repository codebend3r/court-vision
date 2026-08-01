import { type Basis, type FantasyStatLine, type ScoringSettings } from "@/lib/valuation/types";

// Points-League Linear (PRD §6.4): the dot product of the stat line with the
// league's scoring settings. No pool, no standardization.
//
// These defaults are the PRD's example table; the Scoring controls override
// every entry, because a points league's whole identity is its scoring table —
// a league that pays 2 per rebound values very different players.
export const DEFAULT_POINTS_SCORING: ScoringSettings = {
  pts: 1,
  reb: 1.2,
  ast: 1.5,
  stl: 3,
  blk: 3,
  fg3m: 0,
  tov: -1,
};

export const SCORED_KEYS = ["pts", "reb", "ast", "stl", "blk", "fg3m", "tov"] as const;

export const scorePoints = ({
  lines,
  basis,
  scoring = DEFAULT_POINTS_SCORING,
}: {
  lines: readonly FantasyStatLine[];
  basis: Basis;
  scoring?: ScoringSettings;
}): Array<{ playerId: number; total: number }> =>
  lines.map((line) => {
    const raw = SCORED_KEYS.reduce((sum, key) => sum + line[key] * scoring[key], 0);
    const total = basis === "total" ? raw : line.gamesPlayed > 0 ? raw / line.gamesPlayed : 0;
    return { playerId: line.playerId, total };
  });
