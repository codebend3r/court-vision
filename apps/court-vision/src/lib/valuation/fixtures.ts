import { recordFromKeys } from "@vision/core/util/record";
import { BASKETBALL_VALUED_STATS } from "@vision/sport-basketball/descriptor";

import { type FantasyStatLine, type RatioCategory, type StatKey } from "@/lib/valuation/types";

// Flat overrides keep test fixtures short: `makeStatLine({ playerId: 1, pts: 900 })`
// rather than nesting a stats record in every test.
export type FixtureOverrides = Partial<
  Omit<FantasyStatLine, "stats" | "playingTime" | "sq" | "cross"> & Record<StatKey, number>
> & {
  playerId: number;
  minutes?: number;
  sq?: FantasyStatLine["sq"];
  cross?: FantasyStatLine["cross"];
};

const DEFAULT_STATS: Record<StatKey, number> = {
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
};

const RATIO_PARTS: Record<RatioCategory, { made: StatKey; attempted: StatKey }> = {
  fg: { made: "fgm", attempted: "fga" },
  ft: { made: "ftm", attempted: "fta" },
};

// Test fixture builder. Unless a test overrides `sq`/`cross`, the moments
// describe a player who posts an identical line every game, so within-player
// variance is exactly 0 and G-Score degenerates to Z-Score — the neutral
// baseline most tests want.
export const makeStatLine = (overrides: FixtureOverrides): FantasyStatLine => {
  const games = overrides.gamesPlayed ?? 50;
  const stats = recordFromKeys({
    keys: BASKETBALL_VALUED_STATS,
    value: (key) => overrides[key] ?? DEFAULT_STATS[key],
  });
  const constantSq = (total: number): number => (games > 0 ? (total * total) / games : 0);
  const sq =
    overrides.sq ??
    recordFromKeys({ keys: BASKETBALL_VALUED_STATS, value: (key) => constantSq(stats[key]) });
  const constantCross = ({ made, attempted }: { made: StatKey; attempted: StatKey }): number =>
    games > 0 ? (stats[made] * stats[attempted]) / games : 0;
  const cross = overrides.cross ?? {
    fg: constantCross(RATIO_PARTS.fg),
    ft: constantCross(RATIO_PARTS.ft),
  };
  return {
    playerId: overrides.playerId,
    firstName: overrides.firstName ?? "Test",
    lastName: overrides.lastName ?? `Player ${overrides.playerId}`,
    fullName: overrides.fullName ?? `Test Player ${overrides.playerId}`,
    teamAbbr: overrides.teamAbbr === undefined ? "BOS" : overrides.teamAbbr,
    position: overrides.position === undefined ? "G" : overrides.position,
    nbaPersonId: overrides.nbaPersonId ?? null,
    gamesPlayed: games,
    playingTime: overrides.minutes ?? 1500,
    stats,
    sq,
    cross,
  };
};
