-- CreateTable
CREATE TABLE "PlayerAdvancedGameLog" (
    "id" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "gameId" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "season" TEXT NOT NULL,
    "seasonType" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "teamAbbr" TEXT NOT NULL,
    "pie" DOUBLE PRECISION,
    "pace" DOUBLE PRECISION,
    "assistPercentage" DOUBLE PRECISION,
    "assistRatio" DOUBLE PRECISION,
    "assistToTurnover" DOUBLE PRECISION,
    "defensiveRating" DOUBLE PRECISION,
    "defensiveReboundPercentage" DOUBLE PRECISION,
    "effectiveFieldGoalPercentage" DOUBLE PRECISION,
    "netRating" DOUBLE PRECISION,
    "offensiveRating" DOUBLE PRECISION,
    "offensiveReboundPercentage" DOUBLE PRECISION,
    "reboundPercentage" DOUBLE PRECISION,
    "trueShootingPercentage" DOUBLE PRECISION,
    "turnoverRatio" DOUBLE PRECISION,
    "usagePercentage" DOUBLE PRECISION,

    CONSTRAINT "PlayerAdvancedGameLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerAdvancedGameLog_playerId_gameDate_idx" ON "PlayerAdvancedGameLog"("playerId", "gameDate");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAdvancedGameLog_playerId_gameId_key" ON "PlayerAdvancedGameLog"("playerId", "gameId");

-- AddForeignKey
ALTER TABLE "PlayerAdvancedGameLog" ADD CONSTRAINT "PlayerAdvancedGameLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
