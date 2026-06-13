-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Player" (
    "id" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "teamId" INTEGER,
    "teamAbbr" TEXT,
    "position" TEXT,
    "jerseyNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSeasonStats" (
    "id" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "season" TEXT NOT NULL,
    "seasonType" TEXT NOT NULL,
    "gamesPlayed" INTEGER NOT NULL,
    "minutes" DOUBLE PRECISION NOT NULL,
    "fgm" INTEGER NOT NULL,
    "fga" INTEGER NOT NULL,
    "fg3m" INTEGER NOT NULL,
    "fg3a" INTEGER NOT NULL,
    "ftm" INTEGER NOT NULL,
    "fta" INTEGER NOT NULL,
    "oreb" INTEGER NOT NULL,
    "dreb" INTEGER NOT NULL,
    "reb" INTEGER NOT NULL,
    "ast" INTEGER NOT NULL,
    "stl" INTEGER NOT NULL,
    "blk" INTEGER NOT NULL,
    "tov" INTEGER NOT NULL,
    "pts" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerSeasonStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameLog" (
    "id" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "gameId" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "season" TEXT NOT NULL,
    "seasonType" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "teamAbbr" TEXT NOT NULL,
    "matchup" TEXT NOT NULL,
    "opponentAbbr" TEXT,
    "homeAway" TEXT NOT NULL,
    "winLoss" TEXT,
    "minutes" DOUBLE PRECISION NOT NULL,
    "fgm" INTEGER NOT NULL,
    "fga" INTEGER NOT NULL,
    "fg3m" INTEGER NOT NULL,
    "fg3a" INTEGER NOT NULL,
    "ftm" INTEGER NOT NULL,
    "fta" INTEGER NOT NULL,
    "oreb" INTEGER NOT NULL,
    "dreb" INTEGER NOT NULL,
    "reb" INTEGER NOT NULL,
    "ast" INTEGER NOT NULL,
    "stl" INTEGER NOT NULL,
    "blk" INTEGER NOT NULL,
    "tov" INTEGER NOT NULL,
    "pts" INTEGER NOT NULL,
    "plusMinus" INTEGER,

    CONSTRAINT "PlayerGameLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonStats_playerId_season_seasonType_key" ON "PlayerSeasonStats"("playerId", "season", "seasonType");

-- CreateIndex
CREATE INDEX "PlayerGameLog_gameDate_idx" ON "PlayerGameLog"("gameDate");

-- CreateIndex
CREATE INDEX "PlayerGameLog_playerId_gameDate_idx" ON "PlayerGameLog"("playerId", "gameDate");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameLog_playerId_gameId_key" ON "PlayerGameLog"("playerId", "gameId");

-- AddForeignKey
ALTER TABLE "PlayerSeasonStats" ADD CONSTRAINT "PlayerSeasonStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameLog" ADD CONSTRAINT "PlayerGameLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

