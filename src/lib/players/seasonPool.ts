import type { PlayerSeasonStats } from "@generated/prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

// Placing one player's averages on the league leaderboards needs the whole
// qualified pool, not just their own row — so every player page view read the
// full season table. The pool only changes when the sync job runs, so it is
// cached per season instead of re-read for each visitor.
const REVALIDATE_SECONDS = 300;

// Shared with the players search caches so one future revalidation busts both.
const PLAYERS_CACHE_TAG = "players";

const cachedSeasonPool = unstable_cache(
  (args: { season: string; seasonType: string }): Promise<PlayerSeasonStats[]> =>
    prisma.playerSeasonStats.findMany({ where: args }),
  ["players:season-pool"],
  { revalidate: REVALIDATE_SECONDS, tags: [PLAYERS_CACHE_TAG] },
);

export const getSeasonStatsPool = (args: {
  season: string;
  seasonType: string;
}): Promise<PlayerSeasonStats[]> => cachedSeasonPool(args);
