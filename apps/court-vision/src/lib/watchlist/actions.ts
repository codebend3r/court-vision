"use server";

import { isActionInt, isOptionalActionId } from "@vision/core/util/argGuards";
import { getProfile } from "@/lib/auth/session";
import { withProfile } from "@/lib/auth/withProfile";
import { ensureDefaultLeague } from "@/lib/leagues/queries";
import { prisma } from "@/lib/prisma";
import { lockLeague } from "@/lib/leagues/locks";
import { MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { type WatchlistActionResult } from "@/lib/watchlist/types";

type StarPlayerProps = {
  playerId: number;
  leagueId: string | null;
};

export const starPlayer = async ({
  playerId,
  leagueId,
}: StarPlayerProps): Promise<WatchlistActionResult> => {
  if (!isActionInt(playerId) || !isOptionalActionId(leagueId)) return { status: "error" };
  return withProfile<WatchlistActionResult>({
    getProfile,
    run: async ({ profile }) => {
      const league = await ensureDefaultLeague({ profile, expectedLeagueId: leagueId });
      if (league === null) return { status: "error" };
      // Lock the parent before counting so concurrent stars share the same cap.
      return prisma.$transaction(async (tx) => {
        await lockLeague({ tx, leagueId: league.id, profileId: profile.id });
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

type UnstarPlayerProps = {
  playerId: number;
  leagueId: string | null;
};

export const unstarPlayer = async ({
  playerId,
  leagueId,
}: UnstarPlayerProps): Promise<WatchlistActionResult> => {
  // `{ gte: 0 }` here would clear the caller's entire watchlist in one call.
  if (!isActionInt(playerId) || !isOptionalActionId(leagueId)) return { status: "error" };
  return withProfile<WatchlistActionResult>({
    getProfile,
    run: async ({ profile }) => {
      const league = await ensureDefaultLeague({ profile, expectedLeagueId: leagueId });
      if (league === null) return { status: "error" };
      // One transaction, like starPlayer, so the count reflects this delete.
      return prisma.$transaction(async (tx) => {
        await lockLeague({ tx, leagueId: league.id, profileId: profile.id });
        await tx.leagueWatchlistPlayer.deleteMany({ where: { leagueId: league.id, playerId } });
        const count = await tx.leagueWatchlistPlayer.count({ where: { leagueId: league.id } });
        return { status: "ok", count };
      });
    },
  });
};
