"use server";

import { getProfile } from "@/lib/auth/session";
import { ensureDefaultLeague } from "@/lib/leagues/queries";
import { prisma } from "@/lib/prisma";
import { MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { type WatchlistActionResult } from "@/lib/watchlist/types";

// Prisma's unique-constraint code. Re-starring a player the user already
// starred is a no-op, not an error — a double click must not look broken.
const UNIQUE_VIOLATION = "P2002";

const isUniqueViolation = ({ error }: { error: unknown }): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === UNIQUE_VIOLATION;

export const starPlayer = async ({
  playerId,
}: {
  playerId: number;
}): Promise<WatchlistActionResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  const league = await ensureDefaultLeague();
  if (league === null) return { status: "unauthenticated" };
  try {
    // The cap is checked and the row written in one transaction, so a stale
    // client — or a second tab — can never push the list past MAX_WATCHLIST.
    return await prisma.$transaction(async (tx) => {
      const current = await tx.leagueWatchlistPlayer.count({ where: { leagueId: league.id } });
      if (current >= MAX_WATCHLIST) return { status: "limit", count: current };
      try {
        await tx.leagueWatchlistPlayer.create({
          data: { leagueId: league.id, playerId, profileId: profile.id },
        });
      } catch (error) {
        if (!isUniqueViolation({ error })) throw error;
      }
      const count = await tx.leagueWatchlistPlayer.count({ where: { leagueId: league.id } });
      return { status: "ok", count };
    });
  } catch {
    return { status: "error" };
  }
};

export const unstarPlayer = async ({
  playerId,
}: {
  playerId: number;
}): Promise<WatchlistActionResult> => {
  const league = await ensureDefaultLeague();
  if (league === null) return { status: "unauthenticated" };
  try {
    await prisma.leagueWatchlistPlayer.deleteMany({ where: { leagueId: league.id, playerId } });
    const count = await prisma.leagueWatchlistPlayer.count({ where: { leagueId: league.id } });
    return { status: "ok", count };
  } catch {
    return { status: "error" };
  }
};
