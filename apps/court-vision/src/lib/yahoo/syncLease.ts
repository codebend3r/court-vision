import { prisma } from "@/lib/prisma";
import { YAHOO_SYNC_THROTTLE_MS } from "@/lib/yahoo/constants";

type ClaimSyncProps = { profileId: string; leagueId: string };

// A crashed worker's claim expires; its timestamp also fences out late writes.
export const claimSync = async ({ profileId, leagueId }: ClaimSyncProps): Promise<Date | null> => {
  const startedAt = new Date();
  const cutoff = new Date(startedAt.getTime() - YAHOO_SYNC_THROTTLE_MS);
  const claimed = await prisma.league.updateMany({
    where: {
      id: leagueId,
      profileId,
      provider: "yahoo",
      AND: [
        { OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lte: startedAt } }] },
        { OR: [{ syncStartedAt: null }, { syncStartedAt: { lte: cutoff } }] },
        { OR: [{ syncedAt: null }, { syncedAt: { lte: cutoff } }] },
      ],
    },
    data: { syncStartedAt: startedAt, syncLeaseUntil: new Date(startedAt.getTime() + 180_000) },
  });
  return claimed.count === 1 ? startedAt : null;
};

type ReleaseSyncProps = ClaimSyncProps & { syncStartedAt: Date };

export const releaseSync = async ({
  profileId,
  leagueId,
  syncStartedAt,
}: ReleaseSyncProps): Promise<void> => {
  await prisma.league.updateMany({
    where: { id: leagueId, profileId, syncStartedAt },
    data: { syncLeaseUntil: null },
  });
};
