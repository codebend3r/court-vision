import { unstable_cache } from "next/cache";

import { PLAYERS_CACHE_OPTIONS } from "@/lib/cache";
import { filterByOwner, type PlayerOwnerFilter } from "@/lib/players/ownerFilter";
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

// Who holds each player, which the owner quick filter narrows the pool by;
// null where the league's rosters are unknown, so the filter has no effect.
type OwnerScope = { takenIds: ReadonlySet<number> | null };

type OwnerFilteredProps<Row extends { id: number }> = {
  pool: readonly Row[];
  owner: PlayerOwnerFilter;
  takenIds: ReadonlySet<number> | null;
};

const ownerFiltered = <Row extends { id: number }>({
  pool,
  owner,
  takenIds,
}: OwnerFilteredProps<Row>): readonly Row[] =>
  filterByOwner({ rows: pool, owner, takenIds, idOf: (row) => row.id });

type SearchPlayersProps = RegularSearchParams & OwnerScope & { playerIds?: readonly number[] };

export const searchPlayers = async (args: SearchPlayersProps): Promise<PlayersSearchResult> =>
  rankPlayers({
    pool: ownerFiltered({
      pool: await cachedRegularPool(args.range),
      owner: args.owner,
      takenIds: args.takenIds,
    }),
    args,
  });

export const searchPlayersAdvanced = async (
  args: AdvancedSearchParams & OwnerScope,
): Promise<PlayersAdvancedSearchResult> =>
  rankAdvancedPlayers({
    pool: ownerFiltered({
      pool: await cachedAdvancedPool(args.range),
      owner: args.owner,
      takenIds: args.takenIds,
    }),
    args,
  });

// The whole cached pool for a range, for a caller that picks its own players
// out of it (a team's roster) rather than paging through a ranked list.
type GetRegularPoolProps = { range: PlayerGameRange };

export const getRegularPool = ({ range }: GetRegularPoolProps): Promise<PlayerPoolRow[]> =>
  cachedRegularPool(range);

type GetAdvancedPoolProps = {
  range: PlayerGameRange;
};

export const getAdvancedPool = ({ range }: GetAdvancedPoolProps): Promise<AdvancedPlayerRow[]> =>
  cachedAdvancedPool(range);
