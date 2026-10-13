"use server";

import { isActionInt } from "@vision/core/util/argGuards";
import { getProfile } from "@/lib/auth/session";
import { withProfile } from "@/lib/auth/withProfile";
import { ensureDefaultLeague } from "@/lib/leagues/queries";
import { prisma } from "@/lib/prisma";
import { MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { type WatchlistActionResult } from "@/lib/watchlist/types";

export const starPlayer = async ({
  playerId,
}: {
  playerId: number;
}): Promise<WatchlistActionResult> => {
  if (!isActionInt(playerId)) return { status: "error" };
  return withProfile<WatchlistActionResult>({
    getProfile,
    run: async ({ profile }) => {
      const league = await ensureDefaultLeague({ profile });
      if (league === null) return { status: "unauthenticated" };
      // The cap is checked and the row written in one transaction, so a stale
      // client — or a second tab — can never push the list past MAX_WATCHLIST.
      return prisma.$transaction(async (tx) => {
        const current = await tx.leagueWatchlistPlayer.count({ where: { leagueId: league.id } });
        if (current >= MAX_WATCHLIST) return { status: "limit", count: current };
        // Re-starring a player the user already starred is a no-op, not an
        // error — a double click must not look broken. ON CONFLICT DO NOTHING
        // skips the duplicate without failing a statement, which in Postgres
        // would abort the rest of this transaction.
        await tx.leagueWatchlistPlayer.createMany({
          data: [{ leagueId: league.id, playerId, profileId: profile.id }],
          skipDuplicates: true,
        });
        const count = await tx.leagueWatchlistPlayer.count({ where: { leagueId: league.id } });
        return { status: "ok", count };
      });
    },
  });
};

export const unstarPlayer = async ({
  playerId,
}: {
  playerId: number;
}): Promise<WatchlistActionResult> => {
  // `{ gte: 0 }` here would clear the caller's entire watchlist in one call.
  if (!isActionInt(playerId)) return { status: "error" };
  return withProfile<WatchlistActionResult>({
    getProfile,
    run: async ({ profile }) => {
      const league = await ensureDefaultLeague({ profile });
      if (league === null) return { status: "unauthenticated" };
      // One transaction, like starPlayer, so the count reflects this delete.
      return prisma.$transaction(async (tx) => {
        await tx.leagueWatchlistPlayer.deleteMany({ where: { leagueId: league.id, playerId } });
        const count = await tx.leagueWatchlistPlayer.count({ where: { leagueId: league.id } });
        return { status: "ok", count };
      });
    },
  });
};
