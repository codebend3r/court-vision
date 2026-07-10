import { GameLogInput, PlayerInput, SeasonStatsInput } from "@/lib/stats/inputs";
import { parseGameDate, parseMinutes } from "@/lib/stats/parse";

import { SEASON_LABEL, SEASON_TYPE } from "./constants";
import { BdlStat } from "./schemas";

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
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
  const homeAway = team.id === game.home_team_id ? "home" : "away";
  const opponentTeamId = homeAway === "home" ? game.visitor_team_id : game.home_team_id;
  const opponentAbbr = teamAbbrById.get(opponentTeamId) ?? null;
  const playerScore = homeAway === "home" ? game.home_team_score : game.visitor_team_score;
  const opponentScore = homeAway === "home" ? game.visitor_team_score : game.home_team_score;
  const winLoss = playerScore > opponentScore ? "W" : playerScore < opponentScore ? "L" : null;
  const separator = homeAway === "away" ? "@" : "vs.";
  const matchup = `${team.abbreviation} ${separator} ${opponentAbbr ?? ""}`.trim();

  return {
    playerId: stat.player.id,
    gameId: String(game.id),
    gameDate: parseGameDate(game.date),
    season: SEASON_LABEL,
    seasonType: SEASON_TYPE,
    teamId: team.id,
    teamAbbr: team.abbreviation,
    matchup,
    opponentAbbr,
    homeAway,
    winLoss,
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
