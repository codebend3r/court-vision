import { PAGE_SIZES } from "@/lib/players/searchParams";
import { type WindowLog } from "@/lib/valuation/aggregate";
import { type StatKey } from "@/lib/valuation/types";
import { type DatedLog } from "@/lib/watchlist/trend";

// One request covers the page in view, so the cap is the largest page size.
export const MAX_TREND_PLAYERS = Math.max(...PAGE_SIZES);

// A game log as it crosses the server-action boundary: the date travels as an
// ISO string and comes back to a Date through toDatedLogs.
export type FantasyTrendLog = WindowLog & { gameDate: string };

export type FantasyTrendPlayerLogs = { playerId: number; logs: FantasyTrendLog[] };

export type FantasyTrendLogsResult =
  | { status: "ok"; players: FantasyTrendPlayerLogs[] }
  | { status: "error" };

const LOG_NUMBER_KEYS: readonly (StatKey | "minutes")[] = [
  "minutes",
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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

export const toDatedLogs = ({ logs }: { logs: readonly FantasyTrendLog[] }): DatedLog[] =>
  logs.map(({ gameDate, ...stats }) => ({ ...stats, gameDate: new Date(gameDate) }));
