-- CreateTable
CREATE TABLE "WatchlistPlayer" (
    "profileId" UUID NOT NULL,
    "playerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistPlayer_pkey" PRIMARY KEY ("profileId","playerId")
);

-- CreateIndex
CREATE INDEX "WatchlistPlayer_profileId_createdAt_idx" ON "WatchlistPlayer"("profileId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "WatchlistPlayer" ADD CONSTRAINT "WatchlistPlayer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistPlayer" ADD CONSTRAINT "WatchlistPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
