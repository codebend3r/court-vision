import { type Prisma, type Profile } from "@generated/prisma/client";

type LockProfileProps = { tx: Prisma.TransactionClient; profileId: string };

// All league creation/deletion and active-pointer writes lock the profile first.
export const lockProfile = async ({
  tx,
  profileId,
}: LockProfileProps): Promise<Pick<Profile, "activeLeagueId">> => {
  const [profile] = await tx.$queryRaw<Pick<Profile, "activeLeagueId">[]>`
    SELECT "activeLeagueId" FROM "Profile" WHERE id = ${profileId}::uuid FOR UPDATE
  `;
  if (profile === undefined) throw new Error("Profile no longer exists");
  return profile;
};

type LockLeagueProps = { tx: Prisma.TransactionClient; leagueId: string; profileId: string };

export const lockLeague = async ({ tx, leagueId, profileId }: LockLeagueProps): Promise<void> => {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "League" WHERE id = ${leagueId} AND "profileId" = ${profileId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) throw new Error("League no longer exists");
};
