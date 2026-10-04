import { unstable_cache } from "next/cache";

import {
  fetchRegularPool,
  rankPlayers,
  type PlayerPoolRow,
  type PlayersSearchResult,
} from "@/lib/players/search";
import {
  fetchAdvancedPool,
  rankAdvancedPlayers,
  type AdvancedPlayerRow,
  type PlayersAdvancedSearchResult,
} from "@/lib/players/searchAdvanced";
import { type PlayerGameRange, type PlayersSearchParams } from "@/lib/players/searchParams";

// Season stats only change when the sync job runs, so each range's aggregated
// pool is cached and every view over it (search text, sort, direction, mode,
// minimums, page, page size) ranks in memory. The key is the range alone:
// keying on the full params would re-run the aggregate for every page flip and
// keystroke, and fragment the cache into thousands of near-identical entries.
// Each pool is well under unstable_cache's 2MB entry ceiling (~1.5k players).
const REVALIDATE_SECONDS = 300;

// Shared tag so a future on-demand revalidation (e.g. a route handler invoked at
// the end of a sync) can bust every players view at once with revalidateTag.
const PLAYERS_CACHE_TAG = "players";

const cachedRegularPool = unstable_cache(
  (range: PlayerGameRange): Promise<PlayerPoolRow[]> => fetchRegularPool({ range }),
  ["players:regular-pool"],
  { revalidate: REVALIDATE_SECONDS, tags: [PLAYERS_CACHE_TAG] },
);

const cachedAdvancedPool = unstable_cache(
  (range: PlayerGameRange): Promise<AdvancedPlayerRow[]> => fetchAdvancedPool({ range }),
  ["players:advanced-pool"],
  { revalidate: REVALIDATE_SECONDS, tags: [PLAYERS_CACHE_TAG] },
);

export const searchPlayers = async (
  args: PlayersSearchParams & { playerIds?: readonly number[] },
): Promise<PlayersSearchResult> => {
  // An empty watchlist has nothing to rank; skip the pool read entirely.
  if (args.playerIds !== undefined && args.playerIds.length === 0) {
    return { rows: [], total: 0, page: 1 };
  }
  return rankPlayers({ pool: await cachedRegularPool(args.range), args });
};

export const searchPlayersAdvanced = async (
  args: PlayersSearchParams,
): Promise<PlayersAdvancedSearchResult> =>
  rankAdvancedPlayers({ pool: await cachedAdvancedPool(args.range), args });
