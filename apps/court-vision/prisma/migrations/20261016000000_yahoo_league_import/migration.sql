-- AlterTable
ALTER TABLE "League" ADD COLUMN     "externalKey" TEXT,
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "myTeamId" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3),
ADD COLUMN     "unsupportedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "LeagueTeam" ADD COLUMN     "externalKey" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "managerName" TEXT;

-- AlterTable
ALTER TABLE "LeagueTeamSlot" ADD COLUMN     "externalPlayerKey" TEXT,
ADD COLUMN     "externalPlayerName" TEXT,
ADD COLUMN     "injuryStatus" TEXT;

-- CreateTable
CREATE TABLE "PlayerExternalId" (
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "eligiblePositions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerExternalId_pkey" PRIMARY KEY ("provider","externalId")
);

-- CreateTable
CREATE TABLE "LeagueWaiverPlayer" (
    "leagueId" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "profileId" UUID NOT NULL,
    "injuryStatus" TEXT,

    CONSTRAINT "LeagueWaiverPlayer_pkey" PRIMARY KEY ("leagueId","playerId")
);

-- CreateIndex
CREATE INDEX "PlayerExternalId_playerId_idx" ON "PlayerExternalId"("playerId");

-- CreateIndex
CREATE INDEX "LeagueWaiverPlayer_profileId_idx" ON "LeagueWaiverPlayer"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "League_myTeamId_key" ON "League"("myTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "League_profileId_provider_externalKey_key" ON "League"("profileId", "provider", "externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueTeam_leagueId_externalKey_key" ON "LeagueTeam"("leagueId", "externalKey");

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_myTeamId_fkey" FOREIGN KEY ("myTeamId") REFERENCES "LeagueTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerExternalId" ADD CONSTRAINT "PlayerExternalId_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueWaiverPlayer" ADD CONSTRAINT "LeagueWaiverPlayer_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueWaiverPlayer" ADD CONSTRAINT "LeagueWaiverPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security. Every table in `public` needs it or Supabase flags it as
-- `rls_disabled_in_public`.

-- Provider-to-player id map. Written and read only by the server (Prisma
-- connects as the Postgres role and bypasses RLS), so there are deliberately no
-- policies: anon and authenticated PostgREST clients get no access at all.
ALTER TABLE public."PlayerExternalId" ENABLE ROW LEVEL SECURITY;

-- Per-profile waiver pool. Owners may read and delete their own rows; an insert
-- must also prove the league belongs to the caller, not just that the
-- denormalized profileId matches (same rule as `league_watchlist_owner_insert`).
ALTER TABLE public."LeagueWaiverPlayer" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "league_waiver_owner_select" ON public."LeagueWaiverPlayer";
CREATE POLICY "league_waiver_owner_select" ON public."LeagueWaiverPlayer" FOR SELECT
  USING (auth.uid() = "profileId");

DROP POLICY IF EXISTS "league_waiver_owner_insert" ON public."LeagueWaiverPlayer";
CREATE POLICY "league_waiver_owner_insert" ON public."LeagueWaiverPlayer" FOR INSERT
  WITH CHECK (
    auth.uid() = "profileId"
    AND EXISTS (
      SELECT 1 FROM "League" l
      WHERE l.id = "leagueId" AND l."profileId" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "league_waiver_owner_delete" ON public."LeagueWaiverPlayer";
CREATE POLICY "league_waiver_owner_delete" ON public."LeagueWaiverPlayer" FOR DELETE
  USING (auth.uid() = "profileId");

-- The server bypasses RLS, so no PostgREST client has a legitimate reason to
-- write to the waiver pool; the policies above stay as defense in depth.
REVOKE INSERT, UPDATE, DELETE ON public."LeagueWaiverPlayer" FROM anon, authenticated;
