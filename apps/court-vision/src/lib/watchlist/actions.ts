"use server";

import { type Prisma } from "@generated/prisma/client";

import { isActionInt, isOptionalActionId } from "@vision/core/util/argGuards";
import { getProfile } from "@/lib/auth/session";
import { withProfile } from "@/lib/auth/withProfile";
import { ensureDefaultLeague } from "@/lib/leagues/queries";
import { prisma } from "@/lib/prisma";
import { lockLeague } from "@/lib/leagues/locks";
import { MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { type WatchlistActionResult } from "@/lib/watchlist/types";

// What a star or unstar runs against: the league it targets, already locked.
type MutateProps = { tx: Prisma.TransactionClient; leagueId: string; profileId: string };

// The flow both actions share: resolve the league the tab displayed (a stale
// tab is refused), lock it so concurrent writes see one count, run the
// change, and answer with the count after it. `mutate` returns a result to
// stop early (the cap), or null to report the new count.
type WithLockedWatchlistProps = {
  playerId: number;
  leagueId: string | null;
  mutate: (args: MutateProps) => Promise<WatchlistActionResult | null>;
};

const withLockedWatchlist = async ({
  playerId,
  leagueId,
  mutate,
}: WithLockedWatchlistProps): Promise<WatchlistActionResult> => {
  // `{ gte: 0 }` as a playerId would clear the caller's entire watchlist in one
  // call, and an object leagueId would become a Prisma filter.
  if (!isActionInt(playerId) || !isOptionalActionId(leagueId)) return { status: "error" };
  return withProfile<WatchlistActionResult>({
    getProfile,
    run: async ({ profile }) => {
      const league = await ensureDefaultLeague({ profile, expectedLeagueId: leagueId });
      if (league === null) return { status: "error" };
      return prisma.$transaction(async (tx) => {
        await lockLeague({ tx, leagueId: league.id, profileId: profile.id });
        const stopped = await mutate({ tx, leagueId: league.id, profileId: profile.id });
        if (stopped !== null) return stopped;
        const count = await tx.leagueWatchlistPlayer.count({ where: { leagueId: league.id } });
        return { status: "ok", count };
      });
    },
  });
};

type StarPlayerProps = {
  playerId: number;
  leagueId: string | null;
};

export const starPlayer = async ({
  playerId,
  leagueId,
}: StarPlayerProps): Promise<WatchlistActionResult> =>
  withLockedWatchlist({
    playerId,
    leagueId,
    mutate: async ({ tx, leagueId: lockedId, profileId }) => {
      // Counted under the lock, so concurrent stars share the same cap.
      const current = await tx.leagueWatchlistPlayer.count({ where: { leagueId: lockedId } });
      if (current >= MAX_WATCHLIST) return { status: "limit", count: current };
      // Re-starring a player the user already starred is a no-op, not an
      // error — a double click must not look broken. ON CONFLICT DO NOTHING
      // skips the duplicate without failing a statement, which in Postgres
      // would abort the rest of this transaction.
      await tx.leagueWatchlistPlayer.createMany({
        data: [{ leagueId: lockedId, playerId, profileId }],
        skipDuplicates: true,
      });
      return null;
    },
  });

type UnstarPlayerProps = {
  playerId: number;
  leagueId: string | null;
};

export const unstarPlayer = async ({
  playerId,
  leagueId,
}: UnstarPlayerProps): Promise<WatchlistActionResult> =>
  withLockedWatchlist({
    playerId,
    leagueId,
    mutate: async ({ tx, leagueId: lockedId }) => {
      await tx.leagueWatchlistPlayer.deleteMany({ where: { leagueId: lockedId, playerId } });
      return null;
    },
  });
