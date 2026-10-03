import { SEASON_LABEL, SEASON_TYPE } from "@/lib/balldontlie/constants";
import { BdlGame } from "@/lib/balldontlie/schemas";
import { deriveGameContext } from "@/lib/balldontlie/transform";
import { GameLogInput } from "@/lib/stats/inputs";

import { createPrng, gaussian } from "@/lib/demo/prng";
import { DemoProfile, MeanSpread } from "@/lib/demo/profiles";

const nonNegInt = (args: { rng: () => number; meanSpread: MeanSpread }): number => {
  const { rng, meanSpread } = args;
  return Math.max(0, Math.round(gaussian({ rng, ...meanSpread })));
};

const boundedPct = (args: { rng: () => number; pct: number }): number => {
  const { rng, pct } = args;
  return Math.min(0.95, Math.max(0.1, gaussian({ rng, mean: pct, spread: 0.09 })));
};

const wasPlayed = (game: BdlGame): boolean => game.home_team_score + game.visitor_team_score > 0;

const selectSkippedIndices = (args: {
  rng: () => number;
  playedCount: number;
  gamesPlayed: number;
}): Set<number> => {
  const { rng, playedCount, gamesPlayed } = args;
  const skipCount = Math.max(0, playedCount - gamesPlayed);
  const indices = Array.from({ length: playedCount }, (_, i) => i);
  const skipped = indices
    .map((i) => ({ i, r: rng() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, skipCount)
    .map(({ i }) => i);
  return new Set(skipped);
};

export const generateGameLogs = (args: {
  playerId: number;
  teamId: number;
  teamAbbr: string;
  games: BdlGame[];
  profile: DemoProfile;
  teamAbbrById: Map<number, string>;
}): GameLogInput[] => {
  const { playerId, teamId, teamAbbr, games, profile, teamAbbrById } = args;
  const rng = createPrng(playerId);

  const played = games
    .filter(wasPlayed)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const skippedIndices = selectSkippedIndices({
    rng,
    playedCount: played.length,
    gamesPlayed: profile.gamesPlayed,
  });

  return played
    .filter((_, i) => !skippedIndices.has(i))
    .map((game) => {
      const minutes =
        Math.round(Math.min(44, Math.max(20, gaussian({ rng, ...profile.minutes }))) * 10) / 10;

      const fga = nonNegInt({ rng, meanSpread: profile.fga });
      const fg3a = Math.min(fga, nonNegInt({ rng, meanSpread: profile.fg3a }));
      const fta = nonNegInt({ rng, meanSpread: profile.fta });

      const fg3m = Math.round(fg3a * boundedPct({ rng, pct: profile.fg3Pct }));
      const fg2m = Math.round((fga - fg3a) * boundedPct({ rng, pct: profile.fgPct }));
      const fgm = fg2m + fg3m;
      const ftm = Math.round(fta * boundedPct({ rng, pct: profile.ftPct }));
      const pts = 2 * (fgm - fg3m) + 3 * fg3m + ftm;

      const oreb = nonNegInt({ rng, meanSpread: profile.oreb });
      const dreb = nonNegInt({ rng, meanSpread: profile.dreb });
      const reb = oreb + dreb;
      const ast = nonNegInt({ rng, meanSpread: profile.ast });
      const stl = nonNegInt({ rng, meanSpread: profile.stl });
      const blk = nonNegInt({ rng, meanSpread: profile.blk });
      const tov = nonNegInt({ rng, meanSpread: profile.tov });

      const context = deriveGameContext({ game, teamId, teamAbbr, teamAbbrById });

      return {
        playerId,
        gameId: String(game.id),
        season: SEASON_LABEL,
        seasonType: SEASON_TYPE,
        teamId,
        teamAbbr,
        minutes,
        fgm,
        fga,
        fg3m,
        fg3a,
        ftm,
        fta,
        oreb,
        dreb,
        reb,
        ast,
        stl,
        blk,
        tov,
        pts,
        plusMinus: null,
        ...context,
      };
    });
};
