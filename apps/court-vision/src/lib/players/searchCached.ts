import { unstable_cache } from "next/cache";

import { PLAYERS_CACHE_OPTIONS } from "@/lib/cache";
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
import {
  type AdvancedSearchParams,
  type PlayerGameRange,
  type RegularSearchParams,
} from "@/lib/players/searchParams";

// Season stats only change when the sync job runs, so each range's aggregated
// pool is cached and every view over it (search text, sort, direction, mode,
// minimums, page, page size) ranks in memory. The key is the range alone:
// keying on the full params would re-run the aggregate for every page flip and
// keystroke, and fragment the cache into thousands of near-identical entries.
// Each pool is well under unstable_cache's 2MB entry ceiling (~1.5k players).
const cachedRegularPool = unstable_cache(
  (range: PlayerGameRange): Promise<PlayerPoolRow[]> => fetchRegularPool({ range }),
  ["players:regular-pool"],
  PLAYERS_CACHE_OPTIONS,
);

const cachedAdvancedPool = unstable_cache(
  (range: PlayerGameRange): Promise<AdvancedPlayerRow[]> => fetchAdvancedPool({ range }),
  ["players:advanced-pool"],
  PLAYERS_CACHE_OPTIONS,
);

export const searchPlayers = async (
  args: RegularSearchParams & { playerIds?: readonly number[] },
): Promise<PlayersSearchResult> => rankPlayers({ pool: await cachedRegularPool(args.range), args });

export const searchPlayersAdvanced = async (
  args: AdvancedSearchParams,
): Promise<PlayersAdvancedSearchResult> =>
  rankAdvancedPlayers({ pool: await cachedAdvancedPool(args.range), args });
