import { isRecord } from "@vision/core/util/record";

import { type WatchlistActionResult } from "@/lib/watchlist/types";

// Positional, unlike the repo's object-parameter default: a type predicate
// cannot reference an element of a binding pattern (TS1230), so a guard has to
// name its parameter. Matches isPlayersTab / isCategory elsewhere in the repo.
export const isWatchlistActionResult = (value: unknown): value is WatchlistActionResult => {
  if (!isRecord(value)) return false;
  if (value.status === "ok" || value.status === "limit") return typeof value.count === "number";
  return value.status === "unauthenticated" || value.status === "error";
};
