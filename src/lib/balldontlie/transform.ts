import { GameLogInput, PlayerInput, SeasonStatsInput } from "@/lib/stats/inputs";
import { parseGameDate, parseMinutes } from "@/lib/stats/parse";

import { SEASON_LABEL, SEASON_TYPE } from "@/lib/balldontlie/constants";
import { BdlGame, BdlPlayer, BdlStat } from "@/lib/balldontlie/schemas";

export const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

export const parseHeightInches = (value: string | null | undefined): number | null => {
  const match = /^(\d+)\s*-\s*(\d+)$/.exec((value ?? "").trim());
  if (match === null) return null;
  const feet = Number(match[1]);
  const inches = Number(match[2]);
  return inches < 12 ? feet * 12 + inches : null;
};

export const parseWeightLbs = (value: string | null | undefined): number | null => {
  const normalized = (value ?? "").trim();
  if (!/^\d+$/.test(normalized)) return null;
  const weight = Number(normalized);
  return weight > 0 ? weight : null;
};

export type GameContext = {
  homeAway: "home" | "away";
  opponentAbbr: string | null;
  winLoss: string | null;
  teamScore: number | null;
  opponentScore: number | null;
  matchup: string;
  gameDate: Date;
};

export const deriveGameContext = (args: {
  game: BdlGame;
  teamId: number;
  teamAbbr: string;
  teamAbbrById: Map<number, string>;
}): GameContext => {
  const { game, teamId, teamAbbr, teamAbbrById } = args;
  const homeAway = teamId === game.home_team_id ? "home" : "away";
  const opponentTeamId = homeAway === "home" ? game.visitor_team_id : game.home_team_id;
  const opponentAbbr = teamAbbrById.get(opponentTeamId) ?? null;
  const teamScore = homeAway === "home" ? game.home_team_score : game.visitor_team_score;
  const opponentScore = homeAway === "home" ? game.visitor_team_score : game.home_team_score;
  // 0-0 means the game has not been played, so there is no score to keep.
  const played = teamScore > 0 || opponentScore > 0;
  const winLoss = teamScore > opponentScore ? "W" : teamScore < opponentScore ? "L" : null;
  const separator = homeAway === "away" ? "@" : "vs.";
  return {
    homeAway,
    opponentAbbr,
    winLoss,
    teamScore: played ? teamScore : null,
    opponentScore: played ? opponentScore : null,
    matchup: `${teamAbbr} ${separator} ${opponentAbbr ?? ""}`.trim(),
    gameDate: parseGameDate(game.date),
  };
};

export const toPlayerInputs = (
  stats: BdlStat[],
  teamAbbrById: Map<number, string>,
): PlayerInput[] => {
  const byId = stats.reduce((acc, stat) => {
    const player = stat.player;
    const rawTeamId = player.team_id ?? null;
    const teamId = rawTeamId === 0 ? null : rawTeamId;
    acc.set(player.id, {
      id: player.id,
      firstName: player.first_name,
      lastName: player.last_name,
      fullName: `${player.first_name} ${player.last_name}`,
      teamId,
      teamAbbr: teamId === null ? null : (teamAbbrById.get(teamId) ?? null),
      position: blankToNull(player.position),
      jerseyNumber: blankToNull(player.jersey_number),
    });
    return acc;
  }, new Map<number, PlayerInput>());
  return Array.from(byId.values());
};

export const toGameLogInput = (args: {
  stat: BdlStat;
  teamAbbrById: Map<number, string>;
}): GameLogInput => {
  const { stat, teamAbbrById } = args;
  const { game, team } = stat;
  const context = deriveGameContext({
    game,
    teamId: team.id,
    teamAbbr: team.abbreviation,
    teamAbbrById,
  });

  return {
    playerId: stat.player.id,
    gameId: String(game.id),
    season: SEASON_LABEL,
    seasonType: SEASON_TYPE,
    teamId: team.id,
    teamAbbr: team.abbreviation,
    minutes: parseMinutes(stat.min ?? 0),
    fgm: stat.fgm,
    fga: stat.fga,
    fg3m: stat.fg3m,
    fg3a: stat.fg3a,
    ftm: stat.ftm,
    fta: stat.fta,
    oreb: stat.oreb,
    dreb: stat.dreb,
    reb: stat.reb,
    ast: stat.ast,
    stl: stat.stl,
    blk: stat.blk,
    tov: stat.turnover,
    pts: stat.pts,
    plusMinus: stat.plus_minus ?? null,
    ...context,
  };
};

export const aggregateSeasonStats = (logs: GameLogInput[]): SeasonStatsInput[] => {
  const byPlayer = logs.reduce((acc, log) => {
    const current = acc.get(log.playerId) ?? {
      playerId: log.playerId,
      season: SEASON_LABEL,
      seasonType: SEASON_TYPE,
      gamesPlayed: 0,
      minutes: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      oreb: 0,
      dreb: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pts: 0,
    };
    acc.set(log.playerId, {
      ...current,
      gamesPlayed: current.gamesPlayed + 1,
      minutes: current.minutes + log.minutes,
      fgm: current.fgm + log.fgm,
      fga: current.fga + log.fga,
      fg3m: current.fg3m + log.fg3m,
      fg3a: current.fg3a + log.fg3a,
      ftm: current.ftm + log.ftm,
      fta: current.fta + log.fta,
      oreb: current.oreb + log.oreb,
      dreb: current.dreb + log.dreb,
      reb: current.reb + log.reb,
      ast: current.ast + log.ast,
      stl: current.stl + log.stl,
      blk: current.blk + log.blk,
      tov: current.tov + log.tov,
      pts: current.pts + log.pts,
    });
    return acc;
  }, new Map<number, SeasonStatsInput>());
  return Array.from(byPlayer.values());
};

export const toPlayerInput = (args: { player: BdlPlayer }): PlayerInput => {
  const { player } = args;
  return {
    id: player.id,
    firstName: player.first_name,
    lastName: player.last_name,
    fullName: `${player.first_name} ${player.last_name}`,
    teamId: player.team?.id ?? null,
    teamAbbr: player.team?.abbreviation ?? null,
    position: blankToNull(player.position),
    jerseyNumber: blankToNull(player.jersey_number),
    heightInches: parseHeightInches(player.height),
    weightLbs: parseWeightLbs(player.weight),
    college: blankToNull(player.college),
    country: blankToNull(player.country),
    draftYear: player.draft_year ?? null,
    draftRound: player.draft_round ?? null,
    draftNumber: player.draft_number ?? null,
  };
};
