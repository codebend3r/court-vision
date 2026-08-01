-- DropForeignKey
ALTER TABLE "WatchlistPlayer" DROP CONSTRAINT "WatchlistPlayer_playerId_fkey";

-- DropForeignKey
ALTER TABLE "WatchlistPlayer" DROP CONSTRAINT "WatchlistPlayer_profileId_fkey";

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "activeLeagueId" TEXT,
ADD COLUMN     "fontScale" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "preferredFormula" TEXT;

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "profileId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "scoringType" TEXT NOT NULL DEFAULT 'h2h_categories',
    "teamCount" INTEGER NOT NULL DEFAULT 12,
    "rosterSlots" INTEGER NOT NULL DEFAULT 13,
    "scoringConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueTeam" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "profileId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueTeamSlot" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "profileId" UUID NOT NULL,
    "slotType" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "playerId" INTEGER,

    CONSTRAINT "LeagueTeamSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueWatchlistPlayer" (
    "leagueId" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "profileId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueWatchlistPlayer_pkey" PRIMARY KEY ("leagueId","playerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "League_profileId_slug_key" ON "League"("profileId", "slug");

-- CreateIndex
CREATE INDEX "LeagueTeam_profileId_idx" ON "LeagueTeam"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueTeam_leagueId_slug_key" ON "LeagueTeam"("leagueId", "slug");

-- CreateIndex
CREATE INDEX "LeagueTeamSlot_profileId_idx" ON "LeagueTeamSlot"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueTeamSlot_teamId_position_key" ON "LeagueTeamSlot"("teamId", "position");

-- CreateIndex
CREATE INDEX "LeagueWatchlistPlayer_leagueId_createdAt_idx" ON "LeagueWatchlistPlayer"("leagueId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LeagueWatchlistPlayer_profileId_idx" ON "LeagueWatchlistPlayer"("profileId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_activeLeagueId_fkey" FOREIGN KEY ("activeLeagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueTeam" ADD CONSTRAINT "LeagueTeam_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueTeamSlot" ADD CONSTRAINT "LeagueTeamSlot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueTeamSlot" ADD CONSTRAINT "LeagueTeamSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueWatchlistPlayer" ADD CONSTRAINT "LeagueWatchlistPlayer_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueWatchlistPlayer" ADD CONSTRAINT "LeagueWatchlistPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every profile with starred players gets a default league, becomes
-- its active league, and keeps its stars — before the old table drops.
INSERT INTO "League" ("id", "profileId", "name", "slug", "scoringType", "teamCount", "rosterSlots", "scoringConfig", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."id", 'My League', 'my-league', 'h2h_categories', 12, 13,
  '{"categories":["pts","reb","ast","stl","blk","tpm","tov","fg","ft"]}'::jsonb,
  now(), now()
FROM "Profile" p
WHERE EXISTS (SELECT 1 FROM "WatchlistPlayer" w WHERE w."profileId" = p."id");

UPDATE "Profile" p SET "activeLeagueId" = l."id"
FROM "League" l
WHERE l."profileId" = p."id" AND l."slug" = 'my-league';

INSERT INTO "LeagueWatchlistPlayer" ("leagueId", "playerId", "profileId", "createdAt")
SELECT l."id", w."playerId", w."profileId", w."createdAt"
FROM "WatchlistPlayer" w
JOIN "League" l ON l."profileId" = w."profileId" AND l."slug" = 'my-league';

-- DropTable
DROP TABLE "WatchlistPlayer";
