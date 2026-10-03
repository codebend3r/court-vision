import { type FantasyStatLine, type StatKey } from "@/lib/valuation/types";

const STAT_KEYS: readonly StatKey[] = [
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "fg3m",
  "tov",
  "fgm",
  "fga",
  "ftm",
  "fta",
];

type FixtureOverrides = Partial<FantasyStatLine> & { playerId: number };

// Test fixture builder. Unless a test overrides `sq`/`cross`, the moments
// describe a player who posts an identical line every game, so within-player
// variance is exactly 0 and G-Score degenerates to Z-Score — the neutral
// baseline most tests want.
export const makeStatLine = (overrides: FixtureOverrides): FantasyStatLine => {
  const base = {
    firstName: "Test",
    lastName: `Player ${overrides.playerId}`,
    fullName: `Test Player ${overrides.playerId}`,
    teamAbbr: "BOS",
    position: "G",
    nbaPersonId: null,
    gamesPlayed: 50,
    minutes: 1500,
    pts: 500,
    reb: 200,
    ast: 150,
    stl: 40,
    blk: 20,
    fg3m: 60,
    tov: 80,
    fgm: 180,
    fga: 400,
    ftm: 100,
    fta: 120,
    ...overrides,
  };
  const games = base.gamesPlayed;
  const constantSq = (total: number): number => (games > 0 ? (total * total) / games : 0);
  const sq =
    overrides.sq ??
    STAT_KEYS.reduce<Record<StatKey, number>>(
      (acc, key) => ({ ...acc, [key]: constantSq(base[key]) }),
      { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fg3m: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0 },
    );
  const cross = overrides.cross ?? {
    fg: games > 0 ? (base.fgm * base.fga) / games : 0,
    ft: games > 0 ? (base.ftm * base.fta) / games : 0,
  };
  return { ...base, sq, cross };
};
