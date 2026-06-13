import { z } from "zod";

import { nbaFetch } from "./client";
import { LEAGUE_ID, RESULT_SET_NAMES, SEASON, SEASON_TYPE } from "./constants";
import { parseNbaResponse, rowsToObjects, selectResultSet } from "./parse";
import {
  GameLogRow,
  PlayerIndexRow,
  SeasonStatsRow,
  gameLogRowSchema,
  playerIndexRowSchema,
  seasonStatsRowSchema,
} from "./schemas";

export interface NbaClientDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const PLAYER_INDEX_PARAMS: Record<string, string> = {
  College: "",
  Country: "",
  DraftPick: "",
  DraftRound: "",
  DraftYear: "",
  Height: "",
  Historical: "0",
  LeagueID: LEAGUE_ID,
  Season: SEASON,
  SeasonType: SEASON_TYPE,
  TeamID: "",
  Weight: "",
};

const SEASON_STATS_PARAMS: Record<string, string> = {
  College: "",
  Conference: "",
  Country: "",
  DateFrom: "",
  DateTo: "",
  Division: "",
  DraftPick: "",
  DraftYear: "",
  GameScope: "",
  GameSegment: "",
  Height: "",
  LastNGames: "0",
  LeagueID: LEAGUE_ID,
  Location: "",
  MeasureType: "Base",
  Month: "0",
  OpponentTeamID: "0",
  Outcome: "",
  PORound: "0",
  PaceAdjust: "N",
  PerMode: "Totals",
  Period: "0",
  PlayerExperience: "",
  PlayerPosition: "",
  PlusMinus: "N",
  Rank: "N",
  Season: SEASON,
  SeasonSegment: "",
  SeasonType: SEASON_TYPE,
  ShotClockRange: "",
  StarterBench: "",
  TeamID: "0",
  VsConference: "",
  VsDivision: "",
  Weight: "",
};

const gameLogParams = (dateFrom: string, dateTo: string): Record<string, string> => ({
  DateFrom: dateFrom,
  DateTo: dateTo,
  GameSegment: "",
  LastNGames: "0",
  LeagueID: LEAGUE_ID,
  Location: "",
  MeasureType: "Base",
  Month: "0",
  OppTeamID: "0",
  Outcome: "",
  PORound: "0",
  PerMode: "Totals",
  Period: "0",
  PlayerID: "",
  Season: SEASON,
  SeasonSegment: "",
  SeasonType: SEASON_TYPE,
  ShotClockRange: "",
  TeamID: "",
  VsConference: "",
  VsDivision: "",
});

const fetchRows = async <T>(args: {
  endpoint: string;
  params: Record<string, string>;
  resultSetName: string;
  rowSchema: z.ZodType<T>;
  deps: NbaClientDeps;
}): Promise<T[]> => {
  const raw = await nbaFetch({
    endpoint: args.endpoint,
    params: args.params,
    fetchImpl: args.deps.fetchImpl,
    sleep: args.deps.sleep,
  });
  const response = parseNbaResponse(raw);
  const resultSet = selectResultSet(response, args.resultSetName);
  const objects = rowsToObjects(resultSet);
  return z.array(args.rowSchema).parse(objects);
};

export const fetchPlayerIndex = (deps: NbaClientDeps = {}): Promise<PlayerIndexRow[]> =>
  fetchRows({
    endpoint: "playerindex",
    params: PLAYER_INDEX_PARAMS,
    resultSetName: RESULT_SET_NAMES.playerIndex,
    rowSchema: playerIndexRowSchema,
    deps,
  });

export const fetchSeasonStats = (deps: NbaClientDeps = {}): Promise<SeasonStatsRow[]> =>
  fetchRows({
    endpoint: "leaguedashplayerstats",
    params: SEASON_STATS_PARAMS,
    resultSetName: RESULT_SET_NAMES.seasonStats,
    rowSchema: seasonStatsRowSchema,
    deps,
  });

export const fetchPlayerGameLogs = (
  args: { dateFrom: string; dateTo: string } & NbaClientDeps,
): Promise<GameLogRow[]> =>
  fetchRows({
    endpoint: "playergamelogs",
    params: gameLogParams(args.dateFrom, args.dateTo),
    resultSetName: RESULT_SET_NAMES.gameLogs,
    rowSchema: gameLogRowSchema,
    deps: { fetchImpl: args.fetchImpl, sleep: args.sleep },
  });
