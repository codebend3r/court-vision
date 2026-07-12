export type MeanSpread = {
  mean: number;
  spread: number;
};

export type DemoProfile = {
  fullName: string;
  gamesPlayed: number;
  minutes: MeanSpread;
  fga: MeanSpread;
  fg3a: MeanSpread;
  fta: MeanSpread;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
  oreb: MeanSpread;
  dreb: MeanSpread;
  ast: MeanSpread;
  stl: MeanSpread;
  blk: MeanSpread;
  tov: MeanSpread;
};

// Plausible 2025-26 per-game profiles for five NBA stars — not official stats.
export const DEMO_PROFILES: DemoProfile[] = [
  {
    fullName: "Anthony Edwards",
    gamesPlayed: 79,
    minutes: { mean: 36.3, spread: 3 },
    fga: { mean: 20.3, spread: 4 },
    fg3a: { mean: 10.1, spread: 3 },
    fta: { mean: 6.4, spread: 2.5 },
    fgPct: 0.447,
    fg3Pct: 0.395,
    ftPct: 0.837,
    oreb: { mean: 0.8, spread: 0.9 },
    dreb: { mean: 4.9, spread: 2 },
    ast: { mean: 4.5, spread: 2 },
    stl: { mean: 1.2, spread: 1 },
    blk: { mean: 0.6, spread: 0.7 },
    tov: { mean: 3.3, spread: 1.5 },
  },
  {
    fullName: "Shai Gilgeous-Alexander",
    gamesPlayed: 76,
    minutes: { mean: 34.2, spread: 3 },
    fga: { mean: 21.8, spread: 4 },
    fg3a: { mean: 5.7, spread: 2 },
    fta: { mean: 8.8, spread: 3 },
    fgPct: 0.519,
    fg3Pct: 0.375,
    ftPct: 0.898,
    oreb: { mean: 0.9, spread: 0.9 },
    dreb: { mean: 4.1, spread: 1.8 },
    ast: { mean: 6.4, spread: 2 },
    stl: { mean: 1.7, spread: 1 },
    blk: { mean: 1, spread: 0.9 },
    tov: { mean: 2.4, spread: 1.2 },
  },
  {
    fullName: "Luka Doncic",
    gamesPlayed: 70,
    minutes: { mean: 35.4, spread: 3 },
    fga: { mean: 21, spread: 4 },
    fg3a: { mean: 9.5, spread: 3 },
    fta: { mean: 7.5, spread: 3 },
    fgPct: 0.45,
    fg3Pct: 0.368,
    ftPct: 0.782,
    oreb: { mean: 0.8, spread: 0.9 },
    dreb: { mean: 7.4, spread: 2.5 },
    ast: { mean: 7.7, spread: 2.5 },
    stl: { mean: 1.6, spread: 1 },
    blk: { mean: 0.4, spread: 0.6 },
    tov: { mean: 3.6, spread: 1.5 },
  },
  {
    fullName: "Jayson Tatum",
    gamesPlayed: 74,
    minutes: { mean: 36.4, spread: 3 },
    fga: { mean: 20.5, spread: 4 },
    fg3a: { mean: 9.8, spread: 3 },
    fta: { mean: 6.2, spread: 2.5 },
    fgPct: 0.452,
    fg3Pct: 0.343,
    ftPct: 0.814,
    oreb: { mean: 0.9, spread: 0.9 },
    dreb: { mean: 7.8, spread: 2.5 },
    ast: { mean: 6, spread: 2 },
    stl: { mean: 1.1, spread: 0.9 },
    blk: { mean: 0.5, spread: 0.7 },
    tov: { mean: 2.9, spread: 1.3 },
  },
  {
    fullName: "Giannis Antetokounmpo",
    gamesPlayed: 67,
    minutes: { mean: 34.2, spread: 3 },
    fga: { mean: 19.5, spread: 4 },
    fg3a: { mean: 0.9, spread: 1 },
    fta: { mean: 10.5, spread: 3.5 },
    fgPct: 0.601,
    fg3Pct: 0.222,
    ftPct: 0.617,
    oreb: { mean: 2.2, spread: 1.4 },
    dreb: { mean: 9.7, spread: 3 },
    ast: { mean: 6.5, spread: 2.2 },
    stl: { mean: 0.9, spread: 0.8 },
    blk: { mean: 1.2, spread: 1 },
    tov: { mean: 3.1, spread: 1.4 },
  },
];
