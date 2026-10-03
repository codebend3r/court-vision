import { type WatchlistActionResult } from "@/lib/watchlist/types";

const hasCount = (record: Record<string, unknown>): boolean => typeof record.count === "number";

// Positional, unlike the repo's object-parameter default: a type predicate
// cannot reference an element of a binding pattern (TS1230), so a guard has to
// name its parameter. Matches isPlayersTab / isCategory elsewhere in the repo.
export const isWatchlistActionResult = (value: unknown): value is WatchlistActionResult => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  if (record.status === "ok" || record.status === "limit") return hasCount(record);
  return record.status === "unauthenticated" || record.status === "error";
};
