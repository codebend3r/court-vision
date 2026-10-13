// Best total first; a tie goes to the lower player id, so every ranking the
// engine builds (pool trimming, replacement level, the synthetic draft, the
// roster builder's ranks) comes out the same on every run.
export const byTotalDescending = (
  a: { playerId: number; total: number },
  b: { playerId: number; total: number },
): number => b.total - a.total || a.playerId - b.playerId;
