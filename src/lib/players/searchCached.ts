import { unstable_cache } from "next/cache";

import {
  searchPlayers as searchPlayersUncached,
  type PlayersSearchResult,
} from "@/lib/players/search";
import {
  searchPlayersAdvanced as searchPlayersAdvancedUncached,
  type PlayersAdvancedSearchResult,
} from "@/lib/players/searchAdvanced";
import { type PlayersSearchParams } from "@/lib/players/searchParams";

// Season stats only change when the sync job runs, so caching each distinct
// query keeps repeat views instant: switching back to a tab, toggling
// Regular/Advanced, re-sorting, or paging back all re-serve from cache instead
// of re-running the expensive full-table fetch-and-sort-in-JS. Cold views (a
// tab/sort/page combination not seen within the window) still pay full cost;
// speeding those up needs the query itself pushed into SQL.
const REVALIDATE_SECONDS = 300;

// Shared tag so a future on-demand revalidation (e.g. a route handler invoked at
// the end of a sync) can bust every players view at once with revalidateTag.
const PLAYERS_CACHE_TAG = "players";

// `unstable_cache` folds the call arguments into the cache key, so each unique
// PlayersSearchParams combination (q, page, size, sort, dir, range, mode,
// minimums, tab) gets its own entry.
const cachedRegular = unstable_cache(
  (args: PlayersSearchParams) => searchPlayersUncached(args),
  ["players:regular"],
  { revalidate: REVALIDATE_SECONDS, tags: [PLAYERS_CACHE_TAG] },
);

const cachedAdvanced = unstable_cache(
  (args: PlayersSearchParams) => searchPlayersAdvancedUncached(args),
  ["players:advanced"],
  { revalidate: REVALIDATE_SECONDS, tags: [PLAYERS_CACHE_TAG] },
);

export const searchPlayers = (args: PlayersSearchParams): Promise<PlayersSearchResult> =>
  cachedRegular(args);

export const searchPlayersAdvanced = (
  args: PlayersSearchParams,
): Promise<PlayersAdvancedSearchResult> => cachedAdvanced(args);
