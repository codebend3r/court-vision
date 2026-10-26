import type { Logger } from "@vision/core/util/logger";

import { AdvancedGameLogInput, GameLogInput, SeasonAggregateLog } from "@/lib/stats/inputs";
import { SyncSummary, upsertPlayers, upsertSeasonStats } from "@/lib/stats/persist";

import { BdlClientDeps, fetchTeams } from "@/lib/balldontlie/endpoints";
import { BdlAdvancedStat, BdlStat } from "@/lib/balldontlie/schemas";
import {
  aggregateSeasonStats,
  toAdvancedGameLogInput,
  toGameLogInput,
  toPlayerInputs,
} from "@/lib/balldontlie/transform";

// Every team's abbreviation by Balldontlie team id, which the transforms use to
// name a log's team and opponent.
type FetchTeamAbbrByIdProps = {
  deps: BdlClientDeps;
};

export const fetchTeamAbbrById = async ({
  deps,
}: FetchTeamAbbrByIdProps): Promise<Map<number, string>> => {
  const teams = await fetchTeams({ deps });
  return new Map(teams.map((team) => [team.id, team.abbreviation]));
};

// What a sync owns decides how it writes. The season sync owns whole seasons,
// so it replaces them and sums season lines from the logs it just fetched; the
// nightly sync owns whole games, so it replaces those and sums season lines
// from every stored log of the players who appeared.
type GameLogsProps = { rows: GameLogInput[] };

type AdvancedGameLogsProps = { rows: AdvancedGameLogInput[] };

type SeasonLogsProps = { gameLogs: GameLogInput[] };

export type BoxScoreWriters = {
  gameLogs: (args: GameLogsProps) => Promise<number>;
  advancedGameLogs: (args: AdvancedGameLogsProps) => Promise<number>;
  seasonLogs: (args: SeasonLogsProps) => Promise<SeasonAggregateLog[]>;
};

// Writes one fetched batch of box scores. Callers fetch everything first, so a
// failed fetch leaves the database untouched. Players go first because the
// logs reference them; season lines follow the game logs they are summed from.
type WriteBoxScoresProps = {
  stats: BdlStat[];
  advanced: BdlAdvancedStat[];
  teamAbbrById: Map<number, string>;
  writers: BoxScoreWriters;
  logger: Logger;
};

export const writeBoxScores = async ({
  stats,
  advanced,
  teamAbbrById,
  writers,
  logger,
}: WriteBoxScoresProps): Promise<SyncSummary> => {
  const gameLogInputs = stats.map((stat) => toGameLogInput({ stat, teamAbbrById }));

  const players = await upsertPlayers({ players: toPlayerInputs({ stats, teamAbbrById }) });
  logger(`Upserted ${players} players; replacing game logs…`);

  const gameLogs = await writers.gameLogs({ rows: gameLogInputs });
  logger(`Replaced ${gameLogs} game logs; rebuilding season lines…`);

  const seasonLogs = await writers.seasonLogs({ gameLogs: gameLogInputs });
  const seasonStats = await upsertSeasonStats({ rows: aggregateSeasonStats({ logs: seasonLogs }) });
  logger(`Rebuilt ${seasonStats} season lines; replacing advanced game logs…`);

  const advancedGameLogs = await writers.advancedGameLogs({
    rows: advanced.map((stat) => toAdvancedGameLogInput({ stat })),
  });
  logger(`Replaced ${advancedGameLogs} advanced game logs.`);

  return { players, gameLogs, seasonStats, advancedGameLogs };
};
