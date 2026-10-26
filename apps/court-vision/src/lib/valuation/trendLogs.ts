import { isRecord, recordFromKeys } from "@vision/core/util/record";
import { BASKETBALL_VALUED_STATS } from "@vision/sport-basketball/descriptor";
import { type DatedLog, type StatKey, type WindowLog } from "@vision/sport-basketball/types";

import { PAGE_SIZES } from "@/lib/players/searchParams";

// One request covers the page in view, so the cap is the largest page size.
export const MAX_TREND_PLAYERS = Math.max(...PAGE_SIZES);

// A game log as the database stores it: the flat box score plus minutes.
export type BasketballLogRow = Record<StatKey, number> & { minutes: number };

// The PlayerGameLog columns a rolling trend reads: the date, minutes and every
// valued stat. Shared by every query that feeds toWindowLog.
export const GAME_LOG_SELECT = {
  gameDate: true,
  minutes: true,
  ...recordFromKeys({ keys: BASKETBALL_VALUED_STATS, value: (): true => true }),
};

// The engine's view of a stored game: minutes are basketball's playing time.
type ToWindowLogProps = { row: BasketballLogRow };

export const toWindowLog = ({ row }: ToWindowLogProps): WindowLog => ({
  playingTime: row.minutes,
  stats: recordFromKeys({ keys: BASKETBALL_VALUED_STATS, value: (key) => row[key] }),
});

// A game log as it crosses the server-action boundary: the date travels as an
// ISO string and comes back to a Date through toDatedLogs.
export type FantasyTrendLog = BasketballLogRow & { gameDate: string };

export type FantasyTrendPlayerLogs = { playerId: number; logs: FantasyTrendLog[] };

export type FantasyTrendLogsResult =
  | { status: "ok"; players: FantasyTrendPlayerLogs[] }
  | { status: "error" };

const LOG_NUMBER_KEYS: readonly (StatKey | "minutes")[] = ["minutes", ...BASKETBALL_VALUED_STATS];

const isFantasyTrendLog = (value: unknown): value is FantasyTrendLog =>
  isRecord(value) &&
  typeof value.gameDate === "string" &&
  LOG_NUMBER_KEYS.every((key) => typeof value[key] === "number");

const isFantasyTrendPlayerLogs = (value: unknown): value is FantasyTrendPlayerLogs =>
  isRecord(value) &&
  typeof value.playerId === "number" &&
  Array.isArray(value.logs) &&
  value.logs.every(isFantasyTrendLog);

// A server action's reply is deserialized from the wire, so the client checks
// the shape before reading it rather than trusting the annotation.
export const isFantasyTrendLogsResult = (value: unknown): value is FantasyTrendLogsResult => {
  if (!isRecord(value)) return false;
  if (value.status === "error") return true;
  return (
    value.status === "ok" &&
    Array.isArray(value.players) &&
    value.players.every(isFantasyTrendPlayerLogs)
  );
};

type ToDatedLogsProps = { logs: readonly FantasyTrendLog[] };

export const toDatedLogs = ({ logs }: ToDatedLogsProps): DatedLog[] =>
  logs.map(({ gameDate, ...row }) => ({ ...toWindowLog({ row }), gameDate: new Date(gameDate) }));
